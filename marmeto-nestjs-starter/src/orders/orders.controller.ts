import { Body, Controller, Get, Post } from '@nestjs/common';
import { OrdersService } from './orders.service';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  // POST /api/orders/transform
  @Post('orders/transform')
  transform(@Body() payload: unknown) {
    return this.ordersService.transform(payload);
  }
}
