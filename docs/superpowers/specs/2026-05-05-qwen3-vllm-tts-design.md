# qwen3-vllm-tts Plugin Design

## Background

The user runs a local qwen3-tts service via vLLM (accessible on port 8880) and wants to use it from an Android phone through [tts-server-android](https://github.com/jing332/tts-server-android). The existing `openai` plugin in this repo targets the official OpenAI TTS API and is unsuitable because:

- Hard-coded `https://api.openai.com` URL
- Fixed voice list (`alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`)
- Hard-coded model `tts-1`
- No `language` parameter
- No custom base URL / optional auth

The vLLM-omni qwen3-tts service exposes an **OpenAI-compatible** `/v1/audio/speech` endpoint with qwen3-specific extensions (`language`, `instructions`, `task_type`, etc.).

## Goals

Create a new independent plugin `qwen3-vllm-tts` that:

1. Connects to a user-configurable vLLM base URL (default `http://localhost:8880`)
2. Supports optional API key (local services often require none)
3. Uses the standard OpenAI TTS API body format with the `language` extension
4. Exposes a configurable `language` dropdown (11 supported languages, default `Chinese`)
5. Exposes a configurable `response_format` dropdown (`wav`/`mp3`/`flac`/`opus`, default `wav`)
6. Provides a hard-coded built-in voice list (`aiden`, `dylan`, `eric`, `ono_anna`, `ryan`, `serena`, `sohee`, `uncle_fu`, `vivian`) selectable in the UI
7. Exposes a configurable `instructions` tone dropdown (10 preset tones, default empty)
8. Supports both non-streaming audio file and streaming PCM responses via an on/off toggle (default off)
9. Leaves existing `openai` plugin untouched

## Non-Goals

- Dynamic voice fetching from server (out of scope for MVP)
- `model` selection (user confirmed current deployment cannot change model)
- `task_type` switching (fixed to `CustomVoice`)
- Voice cloning / `ref_audio` support
- WebSocket streaming (HTTP chunked PCM is sufficient)
- Custom/free-form tone input (limited to preset dropdown)

## Architecture

### Files

| File | Source | Description |
|---|---|---|
| `src/qwen3-vllm-tts/qwen3-vllm-tts.js` | New | Plugin main logic (PluginJS + EditorJS) |
| `src/qwen3-vllm-tts/qwen3-vllm-tts_base.json` | New | Plugin metadata (name, pluginId, defVars) |
| `src/qwen3-vllm-tts/qwen3-vllm-tts.json` | Build output | Full plugin JSON (base + embedded code) |
| `build.sh` | Append | Add `qwen3-vllm-tts` build target |

### PluginJS (Runtime)

Exposes `getAudio(text, locale, voice, rate, volume, pitch)`.

**Variables:**

| Variable | Label | Default | Description |
|---|---|---|---|
| `baseUrl` | Base URL | `http://localhost:8880` | vLLM service endpoint |
| `apiKey` | API Key | *(empty)* | Optional Bearer token; omitted from headers if empty |

**Request construction:**

```json
{
    "input": "<text>",
    "voice": "<voice>",
    "response_format": "<format>",
    "speed": <speed>,
    "language": "<language>"
}
```

- `voice` defaults to `"vivian"` if empty
- `speed` = `rate / 20`, clamped to `[0.25, 4.0]`
- `response_format` read from `ttsrv.tts.data["responseFormat"]` (default `"wav"`)
- `language` read from `ttsrv.tts.data["language"]` (default `"Chinese"`)
- `instructions` read from `ttsrv.tts.data["instructions"]` (default `""`); appended to body only when non-empty
- No `model` field (user confirmed model is fixed on server)
- `Authorization: Bearer <apiKey>` header only added when `apiKey` is non-empty

**Streaming branch:**

When `ttsrv.tts.data["streaming"] == "true"`:
- `response_format` is forced to `"pcm"`
- `stream` is set to `true`
- `speed` is omitted from the body (speed adjustment not supported in streaming mode)

**Response handling:**
- Success (`200`): return `resp.body().byteStream()`
- Failure: `throw` string with HTTP status and response body

### EditorJS (Configuration UI)

| Method | Behavior |
|---|---|
| `getLocales()` | `["zh-CN", "en-US", "ja-JP", "ko-KR", "de-DE", "fr-FR", "ru-RU", "pt-PT", "es-ES", "it-IT"]` |
| `getVoices(locale)` | Hard-coded built-in voices: `aiden` / `dylan` / `eric` / `ono_anna` / `ryan` / `serena` / `sohee` / `uncle_fu` / `vivian` |
| `getAudioSampleRate(locale, voice)` | Non-streaming: call `getAudio("test", ...)` then `ttsrv.getAudioSampleRate(audio)` for auto-detection. Streaming: return `24000` (PCM raw has no header for auto-detection) |
| `onLoadUI(ctx, layout)` | Add four widgets: Language spinner, Response Format spinner, Tone spinner, Streaming checkbox |
| `onVoiceChanged(locale, voiceCode)` | No-op |

#### UI Widgets

**Language Spinner**
- Options: `Auto`, `Chinese`, `English`, `Japanese`, `Korean`, `German`, `French`, `Russian`, `Portuguese`, `Spanish`, `Italian`
- Default selected: `Chinese`
- Storage key: `ttsrv.tts.data["language"]`

**Response Format Spinner**
- Options: `wav`, `mp3`, `flac`, `opus`
- Default selected: `wav`
- Storage key: `ttsrv.tts.data["responseFormat"]`

**Tone Spinner**
- Options: `默认(""), 温柔("温柔的语气"), 生气("生气的语调"), 兴奋("兴奋的语气"), 悲伤("悲伤的语调"), 正式("正式的语调"), 轻松("轻松的语调"), 严肃("严肃的语调"), 开心("开心的语气"), 平静("平静的语气")`
- Default selected: `默认` (empty string)
- Storage key: `ttsrv.tts.data["instructions"]`

**Streaming CheckBox**
- Label: `启用流式 (Streaming) — PCM 24kHz，不支持 speed`
- Default: unchecked (`false`)
- Storage key: `ttsrv.tts.data["streaming"]`

## Error Handling

| HTTP Status | User-facing Message |
|---|---|
| `200` | Success — return audio stream |
| `401` / `403` | `"鉴权失败，请检查 API Key"` |
| `404` | `"接口不存在，请检查 Base URL"` |
| `500` / `502` / `503` | `"服务端错误 (${code})，请检查 vLLM 服务状态"` |
| Other | `"status=${code} body=${body}"` |

All errors propagate via `throw` so tts-server-android displays them in Toast/logs.

## Defaults Summary

| Setting | Default Value |
|---|---|
| `baseUrl` | `http://localhost:8880` |
| `apiKey` | *(empty)* |
| `voice` | `vivian` |
| `language` | `Chinese` |
| `response_format` | `wav` |
| `instructions` | *(empty)* |
| `streaming` | `false` |
| `speed` (when rate=20) | `1.0` |

## Constraints & Assumptions

- The vLLM service is already running and exposes `/v1/audio/speech` in OpenAI-compatible format.
- The server is configured for a single model, so the `model` request field is unnecessary.
- The plugin runs within tts-server-android's Rhino JS engine with the `ttsrv` runtime API.
- Voice list is hard-coded; if the server has additional built-in or uploaded voices, they will not appear in the UI unless the plugin code is updated.
- PCM streaming requires the server to have `async_chunk: true` in its stage config.
- The tts-server-android audio player must support raw PCM (24kHz, 16-bit signed, mono) playback when streaming is enabled.
