# Manual verification checklist

After starting the server, POST `sample-order.json` to `/api/orders/transform`.

Check these expected values:

- `order_id`: `"5612345678901"`
- `customer_email`: `"asha.v@example.com"`
- `total_discount_paise`: `25115`
- `shipping_total_paise`: `7900`
- `gift_note`: `"Happy Diwali, Maa!"`
- There should be four output lines.
- The `HAMPER-DIWALI` line should have `net_paise: 131780` and `bundled_skus: ["GIFTBOX-STD"]`.
- Warnings should mention missing `discount_allocations` and null `properties` for line 14004, and the missing amount for the Promo shipping line.
