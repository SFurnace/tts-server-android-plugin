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

function createWavHeader(sampleRate, channels, bitsPerSample) {
    let byteRate = sampleRate * channels * bitsPerSample / 8
    let blockAlign = channels * bitsPerSample / 8
    let bos = new java.io.ByteArrayOutputStream(44)

    function writeString(str) {
        for (let i = 0; i < str.length; i++) {
            bos.write(str.charCodeAt(i))
        }
    }
    function writeIntLE(val) {
        bos.write(val)
        bos.write(val >> 8)
        bos.write(val >> 16)
        bos.write(val >> 24)
    }
    function writeShortLE(val) {
        bos.write(val)
        bos.write(val >> 8)
    }

    writeString("RIFF")
    writeIntLE(0x7FFFFFFF)
    writeString("WAVE")
    writeString("fmt ")
    writeIntLE(16)
    writeShortLE(1)
    writeShortLE(channels)
    writeIntLE(sampleRate)
    writeIntLE(byteRate)
    writeShortLE(blockAlign)
    writeShortLE(bitsPerSample)
    writeString("data")
    writeIntLE(0x7FFFFFFF)

    return bos.toByteArray()
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
    url = ("" + url).replace(/\/$/, "")
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

    let isStreaming = ttsrv.tts.data["streaming"] == "true"

    let body = {
        "input": text,
        "voice": voice,
        "language": language,
    }
    if (isStreaming) {
        body["stream"] = true
        body["response_format"] = "pcm"
    } else {
        body["response_format"] = responseFormat
        body["speed"] = speed
    }
    let tone = ttsrv.tts.data["customTone"]
    if (tone === null || tone === "" || tone === undefined) {
        tone = ttsrv.tts.data["instructions"]
    }
    if (tone !== null && tone !== "" && tone !== undefined) {
        body["instructions"] = tone
    }
    let str = JSON.stringify(body)
    logger.i("request body: " + str)

    let resp = ttsrv.httpPost(url, str, reqHeaders)

    if (resp.isSuccessful()) {
        let audioStream = resp.body().byteStream()
        if (isStreaming) {
            let wavHeader = createWavHeader(24000, 1, 16)
            let headerStream = new java.io.ByteArrayInputStream(wavHeader)
            audioStream = new java.io.SequenceInputStream(headerStream, audioStream)
        }
        return audioStream
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
        let isStreaming = ttsrv.tts.data["streaming"] == "true"
        if (isStreaming) {
            return 24000
        }
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

        let toneSpinner = JSpinner(ctx, "语调 (Tone)")
        let toneItems = [
            Item("默认", ""),
            Item("温柔", "温柔的语气"),
            Item("生气", "生气的语调"),
            Item("兴奋", "兴奋的语气"),
            Item("悲伤", "悲伤的语调"),
            Item("正式", "正式的语调"),
            Item("轻松", "轻松的语调"),
            Item("严肃", "严肃的语调"),
            Item("开心", "开心的语气"),
            Item("平静", "平静的语气"),
        ]
        toneSpinner.items = toneItems

        let currentTone = ttsrv.tts.data["instructions"]
        let tonePos = 0
        for (let i = 0; i < toneItems.length; i++) {
            if (toneItems[i].value === currentTone) {
                tonePos = i
                break
            }
        }
        toneSpinner.selectedPosition = tonePos
        toneSpinner.setOnItemSelected(function (spinner, pos, item) {
            ttsrv.tts.data["instructions"] = item.value
        })
        linerLayout.addView(toneSpinner)
        ttsrv.setMargins(toneSpinner, 0, 8, 10, 0)

        let customToneEdit = new EditText(ctx)
        customToneEdit.setHint("输入自定义语调覆盖上方选择，留空则使用上方选择")
        let savedCustomTone = ttsrv.tts.data["customTone"]
        if (savedCustomTone !== null && savedCustomTone !== undefined) {
            customToneEdit.setText(savedCustomTone)
        }
        customToneEdit.setOnFocusChangeListener(function(view, hasFocus) {
            if (!hasFocus) {
                let text = customToneEdit.getText()
                ttsrv.tts.data["customTone"] = text ? text.toString() : ""
            }
        })
        linerLayout.addView(customToneEdit)
        ttsrv.setMargins(customToneEdit, 0, 8, 10, 0)

        let cb = new CheckBox(ctx)
        cb.setText("启用流式 (Streaming) — PCM 24kHz，不支持 speed")
        cb.setChecked(ttsrv.tts.data["streaming"] == "true")
        cb.setOnCheckedChangeListener(function (view, isChecked) {
            ttsrv.tts.data["streaming"] = isChecked + ''
        })
        linerLayout.addView(cb)
        ttsrv.setMargins(cb, 0, 8, 10, 0)
    },

    "onVoiceChanged": function (locale, voiceCode) {
    }
}
