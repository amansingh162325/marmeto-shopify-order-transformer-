
import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';

import { ConfigService } from '@nestjs/config';

import {
  ShopifyOrderRecord,
  ShopifyOrderDocument,
} from './shopify-order.schema';

import { transformOrder } from '../orders/transform-order';

@Controller('webhooks/shopify')
export class ShopifyWebhooksController {
  constructor(
    @InjectModel(ShopifyOrderRecord.name)
    private readonly orderModel: Model<ShopifyOrderDocument>,

    private readonly configService: ConfigService,
  ) {}

  private verifyShopifyHmac(
    rawBody: Buffer,
    receivedHmac: string,
  ): boolean {
    const secret = this.configService.get<string>(
      'SHOPIFY_WEBHOOK_SECRET',
    );

    if (!secret || !receivedHmac) {
      return false;
    }

    const calculatedHmac = createHmac('sha256', secret)
      .update(rawBody)
      .digest();

    let receivedBuffer: Buffer;

    try {
      receivedBuffer = Buffer.from(receivedHmac, 'base64');
    } catch {
      return false;
    }

    if (receivedBuffer.length !== calculatedHmac.length) {
      return false;
    }

    return timingSafeEqual(calculatedHmac, receivedBuffer);
  }

  @Post('orders-create')
  async handleOrderCreated(
    @Req() req: RawBodyRequest<Request>,

    @Headers('x-shopify-hmac-sha256')
    hmac: string,

    @Headers('x-shopify-webhook-id')
    webhookId: string,

    @Headers('x-shopify-shop-domain')
    shopDomain: string,
  ) {
    // 1. Verify that Shopify sent the request.
    if (!req.rawBody || !this.verifyShopifyHmac(req.rawBody, hmac)) {
      throw new UnauthorizedException(
        'Invalid Shopify webhook signature',
      );
    }

    // 2. Check required Shopify headers.
    if (!webhookId || !shopDomain) {
      throw new BadRequestException(
        'Missing Shopify webhook headers',
      );
    }

    // 3. Transform the Shopify order.
    const transformedOrder = transformOrder(req.body);

    const shopifyOrderId = String(
      transformedOrder.order_id ?? '',
    );

    if (!shopifyOrderId) {
      throw new BadRequestException(
        'Shopify order ID is missing',
      );
    }

    // 4. Save the order. MongoDB unique indexes prevent duplicates.
    try {
      await this.orderModel.create({
        shopDomain,
        shopifyOrderId,
        webhookId,
        transformedOrder,
      });

      return {
        success: true,
        duplicate: false,
        message: 'Shopify order saved successfully',
        order_id: shopifyOrderId,
      };
    } catch (error: unknown) {
      const mongoError = error as { code?: number };

      // MongoDB duplicate key error.
      if (mongoError.code === 11000) {
        const existingOrder = await this.orderModel.findOne({
          $or: [
            { shopDomain, shopifyOrderId },
            { shopDomain, webhookId },
          ],
        }).lean();

        return {
          success: true,
          duplicate: true,
          message: 'Duplicate webhook/order ignored',
          reason:
            existingOrder?.shopifyOrderId === shopifyOrderId
              ? 'order_already_processed'
              : 'webhook_already_processed',
          order_id: shopifyOrderId,
        };
      }

      throw error;
    }
  }
}
