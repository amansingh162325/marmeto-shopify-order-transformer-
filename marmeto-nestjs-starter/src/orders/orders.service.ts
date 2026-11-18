import { Injectable } from '@nestjs/common';
import { transformOrder } from './transform-order';

@Injectable()
export class OrdersService {
  transform(payload: unknown) {
    return transformOrder(payload);
  }
}
