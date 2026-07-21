import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
from dotenv import load_dotenv

app = Flask(__name__)
# 允許所有來源的請求 (解決 CORS 問題)
CORS(app)

load_dotenv()
# 改為讀取 OpenAI 的 API Key
OPENAI_API_KEY  = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY)

# ==========================================
# 1. 用來「提早喚醒伺服器」的 Ping 通道
# ==========================================
@app.route('/api/ping', methods=['GET'])
def ping():
    return jsonify({"status": "awake", "message": "伺服器已準備就緒！"}), 200

# ==========================================
# 2. 建立接收前端請求的 API 路由 (改用 OpenAI)
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
        # OpenAI 要求的圖片格式必須包含完整的 Data URI scheme
        # 前端傳來的格式通常已包含 "data:image/png;base64,"，若沒有則補上
        if "," not in image_b64:
            image_b64 = f"data:image/jpeg;base64,{image_b64}"

        # 如果使用者沒有輸入文字，給予預設的系統提示詞
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

        # 呼叫 OpenAI API (使用速度極快且便宜的 gpt-4o-mini)
        response = client.chat.completions.create(
            model="gpt-5.4-nano",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_b64
                            }
                        }
                    ]
                }
            ],
            max_tokens=800
        )

        # 提取回傳的文字結果
        reply_text = response.choices[0].message.content
        return jsonify({'reply': reply_text})

    except Exception as e:
        print(f"Error during API call: {e}")
        return jsonify({'reply': f'伺服器發生錯誤: {str(e)}'}), 500

# ==========================================
# 3. 啟動伺服器
# ==========================================
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
