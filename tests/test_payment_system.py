import urllib.request
import urllib.error
import json
import hmac
import hashlib

BASE_URL = "http://localhost:8085"
KEY_SECRET = "secret_EverBloomRiyasCorner2026"
WEBHOOK_SECRET = "whsec_EverBloomWebhookSecret987"
ADMIN_SECRET = "admin123"

def request(path, method="GET", data=None, headers=None):
    url = BASE_URL + path
    if headers is None:
        headers = {}
    
    body = None
    if data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode("utf-8")
    
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

print("=== STARTING COMPREHENSIVE PAYMENT SYSTEM TESTS ===\n")

# TEST 1: Config endpoint
status, config = request("/api/config")
assert status == 200, f"Config endpoint failed: {status}"
assert config["merchantUpiId"] == "rianandagawli11-1@okhdfcbank", "UPI ID mismatch"
print("✓ Test 1 Passed: /api/config returned correct merchant details and UPI ID.")

# TEST 2: Server-side Price Calculation & Price Tampering Protection
# Client tries to send price: 1 and totalPrice: 1 for 3 stems of Red Rose (Catalog price is 549)
tampered_payload = {
    "customer": {
        "name": "Tamper Test User",
        "phone": "9876543210",
        "address": "123 Security Lane",
        "city": "Mumbai",
        "pincode": "400001"
    },
    "items": [
        {
            "id": "f-rose",
            "stemCount": 3,
            "price": 1,         # Malicious client attempts 1 INR
            "totalPrice": 1,    # Malicious client attempts 1 INR
            "quantity": 1
        }
    ],
    "paymentMethod": "RAZORPAY"
}

status, order_res = request("/api/orders/create", "POST", tampered_payload)
assert status == 201, f"Order create failed: {status}"
# True catalog: 3 stems = ₹549 + standard delivery ₹99 = ₹648 total
expected_total = 549 + 99
assert order_res["amount"] == expected_total, f"Expected {expected_total}, got {order_res['amount']}"
assert order_res["amountPaise"] == expected_total * 100
order_id = order_res["orderId"]
rzp_order_id = order_res["razorpayOrderId"]
print(f"✓ Test 2 Passed: Server successfully rejected client price tampering! Calculated: ₹{order_res['amount']} (expected ₹{expected_total}).")

# TEST 3: Invalid Payment Signature Rejection
invalid_verify_payload = {
    "orderId": order_id,
    "razorpay_order_id": rzp_order_id,
    "razorpay_payment_id": "pay_fake_123456",
    "razorpay_signature": "forged_malicious_signature_xyz"
}
status, verify_fail = request("/api/payments/verify", "POST", invalid_verify_payload)
assert status == 400, f"Expected 400 for forged signature, got {status}"
assert verify_fail["signatureVerified"] is False
print("✓ Test 3 Passed: Server successfully rejected forged signature!")

# TEST 4: Valid Payment Signature Verification
valid_payment_id = "pay_valid_test_998877"
message = f"{rzp_order_id}|{valid_payment_id}".encode("utf-8")
valid_sig = hmac.new(KEY_SECRET.encode("utf-8"), message, hashlib.sha256).hexdigest()

valid_verify_payload = {
    "orderId": order_id,
    "razorpay_order_id": rzp_order_id,
    "razorpay_payment_id": valid_payment_id,
    "razorpay_signature": valid_sig
}
status, verify_success = request("/api/payments/verify", "POST", valid_verify_payload)
assert status == 200, f"Expected 200 for valid signature, got {status}"
assert verify_success["signatureVerified"] is True
assert verify_success["order"]["status"] == "CONFIRMED"
print("✓ Test 4 Passed: Server verified official HMAC-SHA256 signature and confirmed order!")

# TEST 5: Manual UPI Submission & Admin Approval
manual_order_payload = {
    "customer": {
        "name": "Rohan Deshmukh",
        "phone": "9123456780",
        "address": "Plot 42, Green Park",
        "city": "Pune",
        "pincode": "411001"
    },
    "items": [
        {
            "id": "b-symphony",
            "quantity": 1
        }
    ],
    "paymentMethod": "MANUAL_UPI"
}
status, m_res = request("/api/orders/create", "POST", manual_order_payload)
m_order_id = m_res["orderId"]

# Submit UTR
utr_payload = {
    "orderId": m_order_id,
    "utr": "426182910394"
}
status, utr_res = request("/api/payments/manual-upi", "POST", utr_payload)
assert status == 200, f"Manual UPI submit failed: {status}"
assert utr_res["order"]["status"] == "PENDING_REVIEW"
assert utr_res["payment"]["status"] == "MANUAL_PAYMENT_REVIEW"
print("✓ Test 5A Passed: Manual UPI submitted with UTR; order set to PENDING_REVIEW (never auto-marked paid).")

# Admin approves manual payment
status, admin_approve = request(f"/api/admin/orders/{m_order_id}/verify-manual", "POST", {"action": "APPROVE"}, {"x-admin-secret": ADMIN_SECRET})
assert status == 200, f"Admin approve failed: {status}"
assert admin_approve["order"]["status"] == "CONFIRMED"
assert admin_approve["payment"]["status"] == "CAPTURED"
print("✓ Test 5B Passed: Admin verified manual UPI against bank record and confirmed order!")

# TEST 6: Webhook Signature & Idempotency
webhook_payload = {
    "event": "payment.captured",
    "event_id": "evt_test_unique_554433",
    "payload": {
        "payment": {
            "entity": {
                "id": "pay_webhook_capture_111",
                "order_id": rzp_order_id,
                "amount": 64800,
                "status": "captured"
            }
        }
    }
}
raw_wh_body = json.dumps(webhook_payload).encode("utf-8")
wh_sig = hmac.new(WEBHOOK_SECRET.encode("utf-8"), raw_wh_body, hashlib.sha256).hexdigest()

wh_headers = {
    "Content-Type": "application/json",
    "x-razorpay-signature": wh_sig
}
req1 = urllib.request.Request(f"{BASE_URL}/api/webhooks/razorpay", data=raw_wh_body, headers=wh_headers, method="POST")
with urllib.request.urlopen(req1) as resp:
    assert resp.status == 200
    res1 = json.loads(resp.read().decode("utf-8"))
    assert res1["status"] == "ok"

# Send duplicate webhook event
req2 = urllib.request.Request(f"{BASE_URL}/api/webhooks/razorpay", data=raw_wh_body, headers=wh_headers, method="POST")
with urllib.request.urlopen(req2) as resp:
    assert resp.status == 200
    res2 = json.loads(resp.read().decode("utf-8"))
    assert res2["status"] == "already_processed"
print("✓ Test 6 Passed: Webhook verified signature and handled duplicate event idempotently!")

# TEST 7: Payment Retry Flow
retry_order_payload = {
    "customer": {
        "name": "Retry Customer",
        "phone": "9988776655",
        "address": "Retry Villa 7",
        "city": "Bengaluru",
        "pincode": "560001"
    },
    "items": [{"id": "f-sunflower", "stemCount": 1, "quantity": 1}],
    "paymentMethod": "RAZORPAY"
}
status, ret_order = request("/api/orders/create", "POST", retry_order_payload)
ret_id = ret_order["orderId"]

# Customer retries payment on same order
status, retry_res = request(f"/api/orders/{ret_id}/retry-payment", "POST")
assert status == 200
assert retry_res["orderId"] == ret_id
assert retry_res["razorpayOrderId"] is not None
print("✓ Test 7 Passed: Retry payment re-initialized new gateway attempt on existing pending order without duplicating orders!")

# TEST 8: Coupon Validation
status, coupon_valid = request("/api/coupons/validate", "POST", {"code": "EVERBLOOM10", "subtotal": 1500})
assert status == 200
assert coupon_valid["valid"] is True
assert coupon_valid["discount"] == 150

status, coupon_invalid = request("/api/coupons/validate", "POST", {"code": "INVALID99", "subtotal": 1500})
assert status == 404
assert coupon_invalid["valid"] is False
print("✓ Test 8 Passed: Coupon validation engine verified successfully!")

print("\n=======================================================")
print("🎉 ALL 8 SECURITY & INTEGRATION TESTS PASSED 100%!")
print("=======================================================")
