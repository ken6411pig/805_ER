import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai

app = Flask(__name__)
# 允許所有來源的請求 (解決 CORS 問題)
CORS(app)

# ==========================================
# 1. 設定你的 Gemini API 金鑰
# ==========================================
# 請將下方的字串替換成你的實際 API Key，或使用環境變數
API_KEY = "AIzaSyCdLNCEoY_q2QXXHdUN4kKJFqMUXPrVLME" 
genai.configure(api_key=API_KEY)

# ==========================================
# 2. 建立接收前端請求的 API 路由
# ==========================================
@app.route('/api/chat', methods=['POST'])
def chat():
    # 取得前端傳來的 JSON 資料
    data = request.json
    message = data.get('message', '').strip()
    image_b64 = data.get('image', None)

    # 防呆：如果沒有圖片，回傳錯誤
    if not image_b64:
        return jsonify({'reply': '錯誤：未提供圖片。'}), 400

    try:
        # 指定使用支援多模態 (圖+文) 且速度快的 flash 模型
        model = genai.GenerativeModel('gemini-3.5-flash')

        # 前端傳來的 Base64 格式通常是 "data:image/png;base64,iVBORw0KGgo..."
        # 我們需要將標頭與實際內容分離
        if "," in image_b64:
            mime_type_str, base64_data = image_b64.split(',', 1)
            # 從 "data:image/png;base64" 萃取出 "image/png"
            mime_type = mime_type_str.split(':')[1].split(';')[0]
        else:
            mime_type = 'image/jpeg'
            base64_data = image_b64

        # 準備要傳給 Gemini 的圖片格式
        image_part = {
            "mime_type": mime_type,
            "data": base64_data
        }

        # 如果使用者沒有輸入文字，給予預設的系統提示詞 (System Prompt)
        if not message:
            prompt = """
            你是一個藥物資訊統整助手。我會提供病患的藥物截圖，格式為: [日期] [開立機構] [診斷] [複方註記] [藥物學名] [商品名]  
            請辨識用藥截圖，並整理成輸出格式，如果是複方藥則把";"改成"/"，如果藥名一樣只需要列出最近一次日期的就好
            把相同日期及地點的藥物整理成同一筆(以","分隔)
            開立機構只要輸出中文名稱。
            輸出格式->[日期] [開立機構]:  [藥物學名]

            除了輸出要求的格式之外，不要多餘的解釋
            """
        else:
            prompt = message

        # 呼叫 Gemini API 進行辨識
        response = model.generate_content([prompt, image_part])

        # 將結果回傳給前端
        return jsonify({'reply': response.text})

    except Exception as e:
        print(f"Error during API call: {e}")
        return jsonify({'reply': f'伺服器發生錯誤: {str(e)}'}), 500

# ==========================================
# 3. 啟動伺服器
# ==========================================
if __name__ == '__main__':
    # 預設會在 127.0.0.1 (localhost) 的 5000 port 執行
    app.run(debug=True, port=5000)