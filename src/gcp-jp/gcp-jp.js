let apiKey = ttsrv.userVars["apiKey"]
let manualLangSpeed = ttsrv.userVars["manualLangSpeed"]

let PluginJS = {
    "name": "GCP日本語TTS",
    "pluginId": "mk.gcp.jp.tts",
    "author": "mkXultra",
    "description": "Google Cloud Text-to-Speech API 日本語専用版",
    "version": 1,

    "vars": {
        apiKey: {label: "API-KEY", hint: "Google Cloud API-KEY"},
        manualLangSpeed: {label: "Manual Language Speed", hint: "Manual Language Speed"},
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
    // 定数定義
    const MAX_BYTES_PER_CHUNK = 250  // Google APIの文単位制限を考慮して小さく設定
    
    
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

    // テキスト全体のバイト数を確認
    let totalBytes = 0
    try {
        totalBytes = new java.lang.String(text).getBytes("UTF-8").length
    } catch (e) {
        totalBytes = 0
    }
    
    // バイト数が多い場合はvoiceをNeural2-Bに変更
    if (totalBytes > MAX_BYTES_PER_CHUNK) {
        if (voice.indexOf("Chirp3-HD") !== -1) {
            voice = "ja-JP-Neural2-B"  // Chirp3-HDの場合はNeural2-Bに切り替え
        }
    }
    
    // 単一リクエストで処理
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
    
    
    try {
        let resp = ttsrv.httpPost('https://texttospeech.googleapis.com/v1/text:synthesize', str, reqHeaders)
        
        if (resp.isSuccessful()) {
            let responseBody = resp.body().string()
            let audioContent = JSON.parse(responseBody).audioContent
            return base64ToByteArray(audioContent)
        } else {
            let errorBody = resp.body().string()
            throw "FAILED: status=" + resp.code() + " body=" + errorBody + 
                  " text_length=" + text.length + "文字" +
                  " text_bytes=" + totalBytes + "バイト" +
                  " voice=" + voice
        }
    } catch (e) {
        if (e.toString().indexOf("FAILED:") === 0) {
            throw e  // 既にフォーマット済みのエラー
        }
        throw "FAILED: " + e + 
              " text_length=" + text.length + "文字" +
              " text_bytes=" + totalBytes + "バイト" +
              " voice=" + voice
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
