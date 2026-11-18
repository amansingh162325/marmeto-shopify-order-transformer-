
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ShopifyWebhooksController } from './shopify-webhooks.controller';
import {
  ShopifyOrderRecord,
  ShopifyOrderSchema,
} from './shopify-order.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: ShopifyOrderRecord.name,
        schema: ShopifyOrderSchema,
      },
    ]),
  ],
  controllers: [ShopifyWebhooksController],
})
export class ShopifyWebhooksModule {}
