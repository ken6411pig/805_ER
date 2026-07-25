import base64
import binascii
import logging
import os
import re

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.exceptions import RequestEntityTooLarge
from openai import OpenAI


load_dotenv()

MAX_MESSAGE_CHARS = 4_000
DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024
DATA_URL_PATTERN = re.compile(
    r"^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$"
)


class ApiError(Exception):
    def __init__(self, status_code, code, message):
        self.status_code = status_code
        self.code = code
        self.message = message
        super().__init__(message)


def get_positive_int(name, default):
    value = os.getenv(name)
    if value is None:
        return default
    try:
        parsed = int(value)
    except ValueError as error:
        raise RuntimeError(f"{name} 必須是正整數。") from error
    if parsed <= 0:
        raise RuntimeError(f"{name} 必須是正整數。")
    return parsed


def get_cors_origins():
    configured_origins = os.getenv("CORS_ORIGINS", "")
    origins = [origin.strip() for origin in configured_origins.split(",") if origin.strip()]
    if origins:
        return origins

    # 專案正式前端與本機開發來源。正式部署可用 CORS_ORIGINS 覆寫或擴充。
    return [
        "https://ken6411pig.github.io",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
    ]


app = Flask(__name__)
max_image_bytes = get_positive_int("MAX_IMAGE_BYTES", DEFAULT_MAX_IMAGE_BYTES)
app.config["MAX_CONTENT_LENGTH"] = (max_image_bytes * 4 // 3) + MAX_MESSAGE_CHARS + 4_096

CORS(
    app,
    resources={r"/api/*": {"origins": get_cors_origins()}},
    methods=["GET", "POST"],
    allow_headers=["Content-Type"],
    supports_credentials=False,
)


def error_response(status_code, code, message):
    return jsonify({"error": {"code": code, "message": message}}), status_code


@app.errorhandler(ApiError)
def handle_api_error(error):
    return error_response(error.status_code, error.code, error.message)


@app.errorhandler(RequestEntityTooLarge)
def handle_request_too_large(_error):
    return error_response(413, "REQUEST_TOO_LARGE", "請求內容過大，請使用較小的圖片。")


@app.errorhandler(Exception)
def handle_unexpected_error(error):
    app.logger.exception("未預期的 API 錯誤", exc_info=error)
    return error_response(500, "INTERNAL_ERROR", "服務暫時無法使用，請稍後再試。")


def get_openai_client():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        app.logger.error("OPENAI_API_KEY 尚未設定。")
        raise ApiError(503, "SERVICE_NOT_CONFIGURED", "服務尚未完成設定，請稍後再試。")
    return OpenAI(api_key=api_key)


def validate_chat_request(data):
    if not isinstance(data, dict):
        raise ApiError(400, "INVALID_JSON", "請求內容必須是 JSON 物件。")

    message = data.get("message", "")
    if not isinstance(message, str):
        raise ApiError(400, "INVALID_MESSAGE", "訊息必須是文字。")
    message = message.strip()
    if len(message) > MAX_MESSAGE_CHARS:
        raise ApiError(400, "MESSAGE_TOO_LONG", f"訊息不得超過 {MAX_MESSAGE_CHARS} 個字元。")

    image_data_url = data.get("image")
    if not isinstance(image_data_url, str):
        raise ApiError(400, "IMAGE_REQUIRED", "請提供圖片。")

    match = DATA_URL_PATTERN.fullmatch(image_data_url.strip())
    if not match:
        raise ApiError(400, "INVALID_IMAGE", "圖片必須是 JPEG、PNG 或 WebP 格式的 Base64 Data URL。")

    try:
        image_bytes = base64.b64decode(match.group(2), validate=True)
    except (binascii.Error, ValueError) as error:
        raise ApiError(400, "INVALID_IMAGE", "圖片資料無法解析。") from error

    if not image_bytes:
        raise ApiError(400, "INVALID_IMAGE", "圖片資料不可為空。")
    if len(image_bytes) > max_image_bytes:
        max_image_mb = max_image_bytes / (1024 * 1024)
        raise ApiError(413, "IMAGE_TOO_LARGE", f"圖片大小不得超過 {max_image_mb:g} MB。")

    return message, image_data_url.strip()


@app.route("/api/ping", methods=["GET"])
def ping():
    return jsonify({"status": "awake", "message": "伺服器已準備就緒！"}), 200


@app.route("/api/chat", methods=["POST"])
def chat():
    message, image_data_url = validate_chat_request(request.get_json(silent=True))

    prompt = message or """
你是一個藥物資訊統整助手。我會提供病患的藥物截圖，格式為: [日期] [開立機構] [診斷] [複方註記] [藥物學名] [商品名]
請辨識用藥截圖，並整理成輸出格式，如果是複方藥則把\";\"改成\"/\"，如果藥名一樣只需要列出最近一次日期的就好。
把相同日期及地點的藥物整理成同一筆(以\",\"分隔)。
開立機構只要輸出中文名稱。
輸出格式->[日期] [開立機構]: [藥物學名]

除了輸出要求的格式之外，不要多餘的解釋。
"""

    response = get_openai_client().chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": image_data_url}},
                ],
            }
        ],
        max_tokens=800,
    )

    reply_text = response.choices[0].message.content or ""
    return jsonify({"reply": reply_text})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
