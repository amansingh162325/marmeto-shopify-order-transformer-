
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

import type { TransformedOrder } from '../orders/transform-order';

export type ShopifyOrderDocument =
  HydratedDocument<ShopifyOrderRecord>;

@Schema({
  timestamps: true,
  collection: 'shopify_orders',
})
export class ShopifyOrderRecord {
  @Prop({ required: true })
  shopDomain!: string;

  @Prop({ required: true })
  shopifyOrderId!: string;

  @Prop({ required: true })
  webhookId!: string;

  @Prop({
    type: MongooseSchema.Types.Mixed,
    required: true,
  })
  transformedOrder!: TransformedOrder;
}

export const ShopifyOrderSchema =
  SchemaFactory.createForClass(ShopifyOrderRecord);

ShopifyOrderSchema.index(
  { shopDomain: 1, shopifyOrderId: 1 },
  { unique: true },
);

ShopifyOrderSchema.index(
  { shopDomain: 1, webhookId: 1 },
  { unique: true },
);
