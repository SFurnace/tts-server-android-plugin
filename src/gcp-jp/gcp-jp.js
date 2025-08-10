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
    // 定数定義
    const MAX_BYTES_PER_CHUNK = 800  // テキスト分割の閾値（バイト）
    
    // デバッグログを格納する変数
    let debugLog = ""
    
    // Rhinoでのログ出力テスト
    try {
        // Javaのprintを試す
        print("=== GCP-JP print test ===")
        print("Text: " + text)
        print("TEST: これはprintのテストです")
        
        // JavaのSystem.out.printlnを試す
        java.lang.System.out.println("=== GCP-JP System.out test ===")
        java.lang.System.out.println("Voice: " + voice)
    } catch (e) {
        // ログ出力が失敗した場合は無視
    }
    
    // 特定の文字列が含まれていたら強制的にデバッグモードON
    if (text.indexOf("彼の企業が繁栄") !== -1) {
        debugMode = true
        debugLog += "=== GCP-JP DEBUG INFO ===\n"
        debugLog += "デバッグモード: 自動ON (特定文字列検出)\n"
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

    // テキスト全体のバイト数を確認
    let totalBytes = 0
    try {
        totalBytes = new java.lang.String(text).getBytes("UTF-8").length
        // if (debugMode === "true" || debugMode === true) {
        //     throw "入力テキスト全体: " + totalBytes + " バイト"
        // }
    } catch (e) {
        // if (debugMode === "true" || debugMode === true) {
        //     throw e
        // }
    }
    
    // テキストを安全なサイズに分割（MAX_BYTES_PER_CHUNKバイト制限）
    let chunks = []
    // 句読点で分割（区切り文字を保持）
    let segments = text.split(/([。、！？\n])/)
    let currentChunk = ""
    
    for (let i = 0; i < segments.length; i++) {
        let segment = segments[i]
        if (segment.length === 0) continue
        
        let testChunk = currentChunk + segment
        
        // バイト数チェック
        try {
            let bytes = new java.lang.String(testChunk).getBytes("UTF-8")
            if (bytes.length > MAX_BYTES_PER_CHUNK) {
                if (currentChunk.length > 0) {
                    chunks.push(currentChunk)
                    currentChunk = segment
                } else {
                    // 単一のセグメントが長すぎる場合は強制分割
                    let byteArray = new java.lang.String(segment).getBytes("UTF-8")
                    let cutPos = MAX_BYTES_PER_CHUNK
                    
                    // UTF-8の境界を考慮して分割
                    while (cutPos > 0 && (byteArray[cutPos] & 0xC0) === 0x80) {
                        cutPos--
                    }
                    
                    let part = new java.lang.String(byteArray, 0, cutPos, "UTF-8")
                    chunks.push(part)
                    currentChunk = segment.substring(part.length())
                }
            } else {
                currentChunk = testChunk
            }
        } catch (e) {
            currentChunk = testChunk
        }
    }
    
    if (currentChunk.length > 0) {
        chunks.push(currentChunk)
    }
    
    // デバッグ情報
    if (debugMode === "true" || debugMode === true) {
        debugLog += "元のテキスト: " + text + "\n"
        debugLog += "元のテキスト長: " + text.length + " 文字, " + totalBytes + " バイト\n"
        debugLog += "MAX_BYTES_PER_CHUNK: " + MAX_BYTES_PER_CHUNK + "\n"
        debugLog += "分割数: " + chunks.length + "\n"
        for (let i = 0; i < chunks.length; i++) {
            let bytes = new java.lang.String(chunks[i]).getBytes("UTF-8")
            debugLog += "Chunk " + (i+1) + ": " + bytes.length + " バイト - " + chunks[i] + "\n"
        }
    }
    
    // 単一チャンクの場合
    if (chunks.length === 1) {
        let body = {
            "input": {
                "text": chunks[0]
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
        
        // デバッグ: JSONリクエストのサイズを確認
        if (debugMode === "true" || debugMode === true) {
            let jsonBytes = new java.lang.String(str).getBytes("UTF-8").length
            debugLog += "\n[単一チャンク] JSONリクエストボディ: " + jsonBytes + " バイト\n"
            debugLog += "JSON内容: " + str + "\n"
            throw debugLog  // HTTPリクエスト前に出力
        }
        
        let resp = ttsrv.httpPost('https://texttospeech.googleapis.com/v1/text:synthesize', str, reqHeaders)
        
        if (resp.isSuccessful()) {
            let responseBody = resp.body().string()
            let audioContent = JSON.parse(responseBody).audioContent
            return base64ToByteArray(audioContent)
        } else {
            let errorBody = resp.body().string()
            throw "FAILED: status=" + resp.code() + " body=" + errorBody + " text=" + chunks[0]
        }
    }
    
    // 複数チャンクの場合 - バイトストリームとして結合
    let outputStream = new java.io.ByteArrayOutputStream()
    
    for (let i = 0; i < chunks.length; i++) {
        let body = {
            "input": {
                "text": chunks[i]
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
        
        // デバッグ: JSONリクエストのサイズを確認
        if (debugMode === "true" || debugMode === true) {
            let jsonBytes = new java.lang.String(str).getBytes("UTF-8").length
            debugLog += "\n[チャンク " + (i+1) + "] JSONリクエストボディ: " + jsonBytes + " バイト\n"
            debugLog += "JSON内容: " + str + "\n"
            // 複数チャンクの場合は最初のチャンクだけでデバッグ終了
            if (i === 0) {
                throw debugLog
            }
        }
        
        let resp = ttsrv.httpPost('https://texttospeech.googleapis.com/v1/text:synthesize', str, reqHeaders)

        if (resp.isSuccessful()) {
            let responseBody = resp.body().string()
            let audioContent = JSON.parse(responseBody).audioContent
            let audioBytes = base64ToByteArray(audioContent)
            outputStream.write(audioBytes)
        } else {
            let errorBody = resp.body().string()
            throw "FAILED: status=" + resp.code() + " body=" + errorBody + " chunk=" + chunks[i]
        }
    }
    
    return outputStream.toByteArray()
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