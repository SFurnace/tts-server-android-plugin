# qwen3-vllm-tts Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a new independent TTS plugin `qwen3-vllm-tts` for tts-server-android that connects to a local vLLM-omni qwen3-tts OpenAI-compatible endpoint.

**Architecture:** A single JS plugin file following the existing tts-server-android plugin pattern (PluginJS for runtime audio synthesis, EditorJS for configuration UI). Plugin metadata stored in JSON, code embedded via `build.sh` using `jq`. No external dependencies.

**Tech Stack:** Rhino JS (tts-server-android runtime), Bash, jq, JSON

---

### Task 1: Create Plugin Main Logic

**Files:**
- Create: `src/qwen3-vllm-tts/qwen3-vllm-tts.js`

- [ ] **Step 1: Create directory and write plugin JS**

```bash
mkdir -p src/qwen3-vllm-tts
```

Write `src/qwen3-vllm-tts/qwen3-vllm-tts.js`:

```javascript
let baseUrl = ttsrv.userVars["baseUrl"]
let apiKey = ttsrv.userVars["apiKey"]

let PluginJS = {
    "name": "qwen3-vllm-tts",
    "pluginId": "com.qwen3.vllm.tts",
    "author": "",
    "description": "Qwen3-TTS via vLLM OpenAI-compatible API",
    "version": 1,

    "vars": {
        baseUrl: {label: "Base URL", hint: "如 http://192.168.1.100:8880"},
        apiKey: {label: "API Key", hint: "留空表示无鉴权"},
    },

    "getAudio": function (text, locale, voice, rate, volume, pitch) {
        return getAudio(text, voice, rate)
    },
}

function getAudio(text, voice, rate) {
    logger.i("getAudio")
    logger.i("rate: " + rate)

    if (voice === null || voice === "") {
        voice = "vivian"
    }

    let speed = 1
    if (rate === null || rate === "" || rate === 0) {
        speed = 1
    } else {
        speed = (parseFloat(rate) / 20)
        speed = Math.max(0.25, Math.min(4.0, parseFloat(speed)))
    }
    logger.i("speed: " + speed)

    let url = baseUrl
    if (url === null || url === "" || url === undefined) {
        url = "http://localhost:8880"
    }
    url = url.replace(/\/$/, "")
    url = url + "/v1/audio/speech"

    let responseFormat = ttsrv.tts.data["responseFormat"]
    if (responseFormat === null || responseFormat === "" || responseFormat === undefined) {
        responseFormat = "wav"
    }

    let language = ttsrv.tts.data["language"]
    if (language === null || language === "" || language === undefined) {
        language = "Chinese"
    }

    let reqHeaders = {
        'Content-Type': 'application/json',
    }
    if (apiKey !== null && apiKey !== "" && apiKey !== undefined) {
        reqHeaders['Authorization'] = 'Bearer ' + apiKey
    }

    let body = {
        "input": text,
        "voice": voice,
        "response_format": responseFormat,
        "speed": speed,
        "language": language,
    }
    let str = JSON.stringify(body)
    logger.i("request body: " + str)

    let resp = ttsrv.httpPost(url, str, reqHeaders)

    if (resp.isSuccessful()) {
        return resp.body().byteStream()
    } else {
        let code = resp.code()
        let msg = ""
        if (code === 401 || code === 403) {
            msg = "鉴权失败，请检查 API Key"
        } else if (code === 404) {
            msg = "接口不存在，请检查 Base URL"
        } else if (code === 500 || code === 502 || code === 503) {
            msg = "服务端错误 (" + code + ")，请检查 vLLM 服务状态"
        } else {
            msg = "status=" + code + " body=" + resp.body().string()
        }
        throw "FAILED: " + msg + " params=" + "text=" + text + " voice=" + voice + " rate=" + rate
    }
}

let EditorJS = {
    'getAudioSampleRate': function (locale, voice) {
        let audio = PluginJS.getAudio('test', locale, voice, 20, 50, 50)
        return ttsrv.getAudioSampleRate(audio)
    },

    "getLocales": function () {
        return ["zh-CN", "en-US", "ja-JP", "ko-KR", "de-DE", "fr-FR", "ru-RU", "pt-PT", "es-ES", "it-IT"]
    },

    "getVoices": function (locale) {
        return {
            "aiden": "Aiden",
            "dylan": "Dylan",
            "eric": "Eric",
            "ono_anna": "Ono Anna",
            "ryan": "Ryan",
            "serena": "Serena",
            "sohee": "Sohee",
            "uncle_fu": "Uncle Fu",
            "vivian": "Vivian",
        }
    },

    "onLoadData": function () {},

    "onLoadUI": function (ctx, linerLayout) {
        let languageSpinner = JSpinner(ctx, "语言 (Language)")
        let languageItems = [
            Item("Auto", "Auto"),
            Item("Chinese", "Chinese"),
            Item("English", "English"),
            Item("Japanese", "Japanese"),
            Item("Korean", "Korean"),
            Item("German", "German"),
            Item("French", "French"),
            Item("Russian", "Russian"),
            Item("Portuguese", "Portuguese"),
            Item("Spanish", "Spanish"),
            Item("Italian", "Italian"),
        ]
        languageSpinner.items = languageItems

        let currentLang = ttsrv.tts.data["language"]
        let langPos = 1
        for (let i = 0; i < languageItems.length; i++) {
            if (languageItems[i].value === currentLang) {
                langPos = i
                break
            }
        }
        languageSpinner.selectedPosition = langPos
        languageSpinner.setOnItemSelected(function (spinner, pos, item) {
            ttsrv.tts.data["language"] = item.value
        })
        linerLayout.addView(languageSpinner)
        ttsrv.setMargins(languageSpinner, 0, 8, 10, 0)

        let formatSpinner = JSpinner(ctx, "音频格式 (Response Format)")
        let formatItems = [
            Item("wav", "wav"),
            Item("mp3", "mp3"),
            Item("flac", "flac"),
            Item("opus", "opus"),
            Item("pcm", "pcm"),
            Item("aac", "aac"),
        ]
        formatSpinner.items = formatItems

        let currentFormat = ttsrv.tts.data["responseFormat"]
        let formatPos = 0
        for (let i = 0; i < formatItems.length; i++) {
            if (formatItems[i].value === currentFormat) {
                formatPos = i
                break
            }
        }
        formatSpinner.selectedPosition = formatPos
        formatSpinner.setOnItemSelected(function (spinner, pos, item) {
            ttsrv.tts.data["responseFormat"] = item.value
        })
        linerLayout.addView(formatSpinner)
        ttsrv.setMargins(formatSpinner, 0, 8, 10, 0)
    },

    "onVoiceChanged": function (locale, voiceCode) {
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/qwen3-vllm-tts/qwen3-vllm-tts.js
git commit -m "feat: add qwen3-vllm-tts plugin main logic

PluginJS with configurable baseUrl/apiKey, OpenAI-compatible
request body with qwen3 language extension. EditorJS with
Language and Response Format spinners.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Create Plugin Metadata

**Files:**
- Create: `src/qwen3-vllm-tts/qwen3-vllm-tts_base.json`

- [ ] **Step 1: Write base JSON**

```json
[
  {
    "version": 2,
    "name": "qwen3-vllm-tts",
    "pluginId": "com.qwen3.vllm.tts",
    "author": "",
    "defVars": {
      "baseUrl": {
        "label": "Base URL"
      },
      "apiKey": {
        "label": "API Key"
      }
    }
  }
]
```

- [ ] **Step 2: Commit**

```bash
git add src/qwen3-vllm-tts/qwen3-vllm-tts_base.json
git commit -m "feat: add qwen3-vllm-tts plugin metadata

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Update Build Script

**Files:**
- Modify: `build.sh`

- [ ] **Step 1: Add qwen3-vllm-tts to target list**

Change the usage echo line from:
```bash
echo "target: gcp, gcp-jp, azure, openai"
```
to:
```bash
echo "target: gcp, gcp-jp, azure, openai, qwen3-vllm-tts"
```

- [ ] **Step 2: Commit**

```bash
git add build.sh
git commit -m "build: add qwen3-vllm-tts target to build.sh

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Build and Verify

**Files:**
- Create: `src/qwen3-vllm-tts/qwen3-vllm-tts.json` (build output)

- [ ] **Step 1: Run build**

```bash
./build.sh qwen3-vllm-tts
```

Expected: No output on success (jq writes silently). Verify exit code is 0.

- [ ] **Step 2: Verify generated JSON**

```bash
# Check file exists and is valid JSON
test -f src/qwen3-vllm-tts/qwen3-vllm-tts.json && jq empty src/qwen3-vllm-tts/qwen3-vllm-tts.json && echo "VALID JSON"
```

Expected output: `VALID JSON`

- [ ] **Step 3: Verify code field is populated**

```bash
jq '.[0].code | length' src/qwen3-vllm-tts/qwen3-vllm-tts.json
```

Expected output: A number greater than 0 (the embedded JS code length).

- [ ] **Step 4: Verify key metadata fields**

```bash
jq '.[0] | {name, pluginId, version, defVars}' src/qwen3-vllm-tts/qwen3-vllm-tts.json
```

Expected output matches the metadata from `qwen3-vllm-tts_base.json` with `defVars` containing `baseUrl` and `apiKey`.

- [ ] **Step 5: Commit build output**

```bash
git add src/qwen3-vllm-tts/qwen3-vllm-tts.json
git commit -m "build: generate qwen3-vllm-tts.json from source

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Self-Review

### Spec Coverage

| Spec Requirement | Implementing Task |
|---|---|
| Independent plugin, no existing files modified | Tasks 1-3 (new files only, build.sh append) |
| Configurable `baseUrl` (default localhost:8880) | Task 1, `vars.baseUrl` + fallback in `getAudio` |
| Optional `apiKey` (omitted if empty) | Task 1, conditional `Authorization` header |
| No `model` field in request body | Task 1, body excludes `model` |
| `language` extension parameter | Task 1, body includes `language` from `ttsrv.tts.data` |
| `response_format` configurable | Task 1, body includes `response_format`; Task 1, UI spinner |
| 11 supported locales | Task 1, `getLocales()` |
| 9 hard-coded voices from server | Task 1, `getVoices()` |
| `speed` = `rate / 20`, clamped [0.25, 4.0] | Task 1, `getAudio()` speed calculation |
| Error handling by HTTP status | Task 1, `getAudio()` error branches |
| Language default = `Chinese` | Task 1, `language` fallback + `langPos = 1` |
| Response format default = `wav` | Task 1, `responseFormat` fallback + `formatPos = 0` |
| `author` empty | Task 2, `"author": ""` in base JSON |

### Placeholder Scan

No TBD/TODO, "implement later", "add appropriate error handling", or "similar to Task N" patterns found. All steps contain complete code or exact commands.

### Type Consistency

- `ttsrv.tts.data["language"]` and `ttsrv.tts.data["responseFormat"]` used consistently in Task 1 (both PluginJS runtime and EditorJS UI)
- `baseUrl` / `apiKey` variable names match between `vars` definition and runtime usage
- `JSpinner` / `Item` / `ttsrv.setMargins` APIs match existing plugin patterns (verified against `src/openai/openai.js` and `ttsrv-Azure-sample.js`)
