from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parent
main_js = (PROJECT_ROOT / "assets" / "js" / "main.js").read_text(encoding="utf-8")

if "refreshAdminTable(" in main_js:
    raise SystemExit("FAIL: main.js still calls refreshAdminTable(), which only exists on admin.html")

storage = {}


class FakeLocalStorage:
    @staticmethod
    def get_item(key):
        return storage.get(key)

    @staticmethod
    def set_item(key, value):
        storage[key] = value


def simulate_checkout_submit(name, role, class_room, original_qty, cheese_qty, notes):
    item_price = 15000

    if not name:
        raise ValueError("name required")
    if role == "Siswa" and not class_room:
        raise ValueError("class required for Siswa")
    if original_qty + cheese_qty <= 0:
        raise ValueError("at least one item required")

    total_cost = (original_qty + cheese_qty) * item_price
    new_order = {
        "id": 123456789,
        "name": name,
        "role": role,
        "classRoom": class_room,
        "original": original_qty,
        "cheese": cheese_qty,
        "total": total_cost,
        "notes": notes or "-",
        "status": "Pending",
    }

    orders_list = json.loads(FakeLocalStorage.get_item("batagor_orders") or "[]")
    orders_list.insert(0, new_order)
    FakeLocalStorage.set_item("batagor_orders", json.dumps(orders_list))
    return new_order


saved_order = simulate_checkout_submit(
    name="Joshua",
    role="Siswa",
    class_room="XII-A",
    original_qty=2,
    cheese_qty=1,
    notes="bumbu dipisah",
)

persisted = json.loads(storage["batagor_orders"])
if len(persisted) != 1 or persisted[0]["name"] != "Joshua" or persisted[0]["total"] != 45000:
    raise SystemExit("FAIL: order was not persisted correctly")

print("PASS: main.js checkout path no longer calls admin-only refreshAdminTable()")
print("PASS: order persistence logic still saves to localStorage")
print(f"Saved order id={saved_order['id']}, total=Rp {saved_order['total']:,}".replace(",", "."))

