let apiKey = ttsrv.userVars["apiKey"]
let manualLangSpeed = ttsrv.userVars["manualLangSpeed"]
let debugMode = ttsrv.userVars["debugMode"]

let PluginJS = {
    "name": "GCP日本語TTS",
    "pluginId": "mk.gcp.jp.tts",
    "author": "mkXultra",
    "description": "Google Cloud Text-to-Speech API 日本語専用版",
    "version": 1,

    "vars": {
        apiKey: {label: "API-KEY", hint: "Google Cloud API-KEY"},
        manualLangSpeed: {label: "Manual Language Speed", hint: "Manual Language Speed"},
        debugMode: {label: "Debug Mode", hint: "true でデバッグ情報を表示"},
    },

    "getAudio": function (text, locale, voice, rate, volume, pitch) {
        return getAudio(text, voice, rate, volume, pitch)
    },
}

function base64ToByteArray(base64) {
    var decoder = java.util.Base64.getDecoder();
    return decoder.decode(base64);
}

function getAudio(text, voice, rate, volume, pitch) {
    // Rhinoでのログ出力テスト
    try {
        // Javaのprintを試す
        print("=== GCP-JP print test ===")
        print("Text: " + text)
        
        // JavaのSystem.out.printlnを試す
        java.lang.System.out.println("=== GCP-JP System.out test ===")
        java.lang.System.out.println("Voice: " + voice)
    } catch (e) {
        // ログ出力が失敗した場合は無視
    }
    
    // デバッグモードチェック
    if (debugMode === "true" || debugMode === true) {
        // デバッグ情報を例外として表示
        let debugInfo = "=== GCP-JP DEBUG INFO ===\n"
        debugInfo += "text: " + text + "\n"
        debugInfo += "text length: " + text.length + "\n"
        debugInfo += "voice: " + voice + "\n"
        debugInfo += "rate: " + rate + "\n"
        
        // 文字エンコーディング確認
        try {
            let bytes = new java.lang.String(text).getBytes("UTF-8")
            debugInfo += "UTF-8 bytes length: " + bytes.length + "\n"
            
            // 最初の10文字の文字コードを確認
            for (let i = 0; i < Math.min(text.length, 10); i++) {
                debugInfo += "char[" + i + "]: " + text.charAt(i) + " (code: " + text.charCodeAt(i) + ")\n"
            }
        } catch (e) {
            debugInfo += "Encoding error: " + e + "\n"
        }
        
        throw debugInfo
    }
    
    let speed = rate
    let jpSpeed = 1
    if (voice === null || voice === "") {
        voice = "ja-JP-Chirp3-HD-Aoede"
    }
    if (rate === null || rate === "" || rate === 0) {
        speed = 1
    } else{
        // kindle reader speed is 1 = 20%
        speed = (parseFloat(rate) / 20)
        // Ensure rate is within the valid range
        speed = Math.max(0.25, Math.min(4.0, parseFloat(speed)))
    }
    
    if(manualLangSpeed < 3){
        jpSpeed = manualLangSpeed
    }
    
    // デバッグ用（必要に応じてコメントアウトを外す）
    // throw "Speed debug - calculated: " + speed + ", jpSpeed: " + jpSpeed + ", manualLangSpeed: " + manualLangSpeed

    let reqHeaders = {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Goog-Api-Key': apiKey
    }

    let body = {
        "input": {
            "text": text
        },
        "voice": {
            "languageCode": "ja-JP",
            "name": voice
        },
        "audioConfig": {
            "audioEncoding": "OGG_OPUS",
            "speakingRate": jpSpeed
        }
    }
    
    let str = JSON.stringify(body)
    logger.i("Request body: " + str)
    logger.i("========================")
    
    let resp = ttsrv.httpPost('https://texttospeech.googleapis.com/v1/text:synthesize', str, reqHeaders)

    if (resp.isSuccessful()) {
        let responseBody = resp.body().string()
        logger.i("Response success")
        let audioContent = JSON.parse(responseBody).audioContent;
        return base64ToByteArray(audioContent)
    } else {
        let errorBody = resp.body().string()
        logger.e("Response failed - status: " + resp.code())
        logger.e("Error body: " + errorBody)
        throw "FAILED: status=" + resp.code() + " body=" + errorBody + " params=" + "text=" + text + " voice=" + voice + " rate=" + rate
    }
}

let EditorJS = {
    'getAudioSampleRate': function (locale, voice) {
        let audio = PluginJS.getAudio('テスト', locale, voice, 20, 50, 50)
        return ttsrv.getAudioSampleRate(audio)
    },

    "getLocales": function () {
        return ["ja-JP"]
    },

    "getVoices": function (locale) {
        return {
            // Chirp3-HD voices (最高品質)
            "ja-JP-Chirp3-HD-Aoede": "女性 Chirp3-HD-Aoede (プレミアム)",
            "ja-JP-Chirp3-HD-Charon": "男性 Chirp3-HD-Charon (プレミアム)",
            "ja-JP-Chirp3-HD-Fenrir": "男性 Chirp3-HD-Fenrir (プレミアム)",
            "ja-JP-Chirp3-HD-Kore": "女性 Chirp3-HD-Kore (プレミアム)",
            "ja-JP-Chirp3-HD-Leda": "女性 Chirp3-HD-Leda (プレミアム)",
            "ja-JP-Chirp3-HD-Orus": "男性 Chirp3-HD-Orus (プレミアム)",
            "ja-JP-Chirp3-HD-Puck": "男性 Chirp3-HD-Puck (プレミアム)",
            "ja-JP-Chirp3-HD-Zephyr": "女性 Chirp3-HD-Zephyr (プレミアム)",
            
            // Neural2 voices (高品質)
            "ja-JP-Neural2-B": "女性 Neural2-B (プレミアム)",
            "ja-JP-Neural2-C": "男性 Neural2-C (プレミアム)",
            "ja-JP-Neural2-D": "男性 Neural2-D (プレミアム)",
            
            // Wavenet voices (プレミアム)
            "ja-JP-Wavenet-A": "女性 Wavenet-A (プレミアム)",
            "ja-JP-Wavenet-B": "女性 Wavenet-B (プレミアム)",
            "ja-JP-Wavenet-C": "男性 Wavenet-C (プレミアム)",
            "ja-JP-Wavenet-D": "男性 Wavenet-D (プレミアム)",
            
            // Standard voices (標準)
            "ja-JP-Standard-A": "女性 Standard-A (標準)",
            "ja-JP-Standard-B": "女性 Standard-B (標準)",
            "ja-JP-Standard-C": "男性 Standard-C (標準)",
            "ja-JP-Standard-D": "男性 Standard-D (標準)"
        }
    },

    "onLoadData": function () {},

    "onLoadUI": function (ctx, linerLayout) {
        // 必要に応じてUIコンポーネントを追加
    },

    "onVoiceChanged": function (locale, voiceCode) {
        logger.i("Voice changed to: " + voiceCode)
    }
}