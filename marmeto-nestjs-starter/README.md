# Marmeto Shopify Order Transformer (NestJS)

A small NestJS API for the Marmeto take-home exercise. It accepts a Shopify-style order JSON payload and returns the requested normalized shape.

## Requirements
- Node.js 20 or newer
- npm
- GitHub account

## Run in GitHub Codespaces

1. Create a new GitHub repository named `marmeto-shopify-order-transformer`.
2. Open the repository, select **Code → Codespaces → Create codespace on main**.
3. Open the Codespaces terminal.
4. If you generated this project using the Nest CLI instead of uploading this starter, copy the `src` files from this project into the generated project.
5. Install dependencies:

   ```bash
   npm install
   ```

6. Start the development server:

   ```bash
   npm run start:dev
   ```

7. Open the **Ports** tab in Codespaces. Port `3000` should be detected. Set its visibility to **Public** only if you intentionally need to share it; otherwise keep it private.
8. Test the health endpoint:

   ```bash
   curl http://localhost:3000/api/health
   ```

   Expected response:

   ```json
   { "status": "ok" }
   ```

## Test the transform endpoint

Send a POST request to:

`http://localhost:3000/api/orders/transform`

Header:

`Content-Type: application/json`

Body: use the Shopify payload supplied in the Marmeto assignment.

Example using curl:

```bash
curl -X POST http://localhost:3000/api/orders/transform \
  -H "Content-Type: application/json" \
  --data-binary @sample-order.json
```

The endpoint returns:
- `order_id`
- `customer_email`
- `lines`
- `total_discount_paise`
- `shipping_total_paise`
- `gift_note`
- `warnings`

## Generate the project yourself with Nest CLI

If starting from an empty Codespace:

```bash
npm i -g @nestjs/cli
nest new marmeto-shopify-order-transformer
cd marmeto-shopify-order-transformer
nest g module orders
nest g controller orders
nest g service orders
```

Choose npm when prompted. Replace/add the source files from this starter, then run `npm install` and `npm run start:dev`.

## Push to GitHub

```bash
git add .
git commit -m "Build Shopify order transformer with NestJS"
git push origin main
```

## Important design notes

- Money is converted to integer paise using `Math.round` to avoid floating-point rupee values in the returned structure.
- Bundle parents are indexed before merging, so a component can appear before or after its parent.
- An orphan bundle component is preserved as a standalone line and a warning is added, rather than silently losing order data.
- Invalid/missing numeric values default to zero with a warning. For a real payment/order pipeline, consider rejecting invalid quantities or routing the order to manual review instead.
- This starter does not persist orders or verify Shopify webhook HMAC signatures. Before production use, add raw-body HMAC verification and database-backed idempotency (for example, a unique index on the Shopify order ID). An in-memory duplicate check is not sufficient across server restarts or multiple instances.
