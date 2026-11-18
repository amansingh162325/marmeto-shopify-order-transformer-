export interface TransformedOrder {
  order_id: string | null;
  customer_email: string | null;
  lines: Array<{
    sku: string | null;
    qty: number;
    net_paise: number;
    bundled_skus: string[];
  }>;
  total_discount_paise: number;
  shipping_total_paise: number;
  gift_note: string | null;
  warnings: string[];
}

type AnyRecord = Record<string, any>;

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function transformOrder(input: unknown): TransformedOrder {
  const payload: AnyRecord = isRecord(input) ? input : {};
  const warnings: string[] = [];

  const warn = (message: string) => {
    if (!warnings.includes(message)) warnings.push(message);
  };

  // Convert a rupee amount to integer paise. Both JSON numbers and strings are accepted.
  const toPaise = (value: unknown, field: string): number => {
    if (
      (typeof value !== 'string' && typeof value !== 'number') ||
      (typeof value === 'string' && value.trim() === '')
    ) {
      warn(`${field} is missing or has an unsupported type; defaulted to 0.`);
      return 0;
    }

    const amount = Number(value);
    if (!Number.isFinite(amount)) {
      warn(`${field} is not a valid number; defaulted to 0.`);
      return 0;
    }

    return Math.round((amount + Number.EPSILON) * 100);
  };

  const toQuantity = (value: unknown, field: string): number => {
    if (
      (typeof value !== 'string' && typeof value !== 'number') ||
      (typeof value === 'string' && value.trim() === '')
    ) {
      warn(`${field} is missing or has an unsupported type; defaulted to 0.`);
      return 0;
    }

    const quantity = Number(value);
    if (!Number.isFinite(quantity) || quantity < 0) {
      warn(`${field} is invalid; defaulted to 0.`);
      return 0;
    }
    return quantity;
  };

  const asArray = (value: unknown, field: string): any[] => {
    if (Array.isArray(value)) return value;
    warn(`${field} is missing or is not an array; treated as an empty array.`);
    return [];
  };

  // Email priority: customer.email, email, then contact_email.
  const emailCandidates = [
    payload.customer?.email,
    payload.email,
    payload.contact_email,
  ];
  const selectedEmail = emailCandidates.find(
    (value) => typeof value === 'string' && value.trim().length > 0,
  );

  // First pass: calculate each line independently. This makes bundle order irrelevant.
  const items = asArray(payload.line_items, 'line_items');
  const processed = items.map((rawItem, index) => {
    const item = isRecord(rawItem) ? rawItem : {};
    if (!isRecord(rawItem)) warn(`line_items[${index}] is invalid; treated as an empty line.`);

    const qty = toQuantity(item.quantity, `line_items[${index}].quantity`);
    const unitPrice = toPaise(item.price, `line_items[${index}].price`);

    const allocations = asArray(
      item.discount_allocations,
      `line_items[${index}].discount_allocations`,
    );
    const lineDiscount = allocations.reduce((sum: number, rawAllocation: unknown, allocationIndex: number) => {
      const allocation = isRecord(rawAllocation) ? rawAllocation : {};
      if (!isRecord(rawAllocation)) {
        warn(`line_items[${index}].discount_allocations[${allocationIndex}] is invalid; treated as 0.`);
      }
      return sum + toPaise(
        allocation.amount,
        `line_items[${index}].discount_allocations[${allocationIndex}].amount`,
      );
    }, 0);

    const properties = asArray(item.properties, `line_items[${index}].properties`);
    const parentProperty = properties.find(
      (property) =>
        isRecord(property) &&
        typeof property.name === 'string' &&
        property.name.trim() === '_bundle_parent',
    );

    return {
      id: item.id == null ? null : String(item.id),
      sku: typeof item.sku === 'string' && item.sku.trim() ? item.sku.trim() : null,
      qty,
      net_paise: unitPrice * qty - lineDiscount,
      discount: lineDiscount,
      parentId:
        isRecord(parentProperty) && parentProperty.value != null
          ? String(parentProperty.value)
          : null,
      bundled_skus: [] as string[],
      isComponent: false,
    };
  });

  const totalDiscount = processed.reduce((sum, line) => sum + line.discount, 0);

  if (payload.total_discounts == null) {
    warn('total_discounts is missing; could not compare order-level discounts.');
  } else {
    const orderDiscount = toPaise(payload.total_discounts, 'total_discounts');
    if (orderDiscount !== totalDiscount) {
      warn('Sum of line discounts does not match total_discounts.');
    }
  }

  // Build the parent lookup only after every line has been processed.
  const linesById = new Map<string, (typeof processed)[number]>();
  for (const line of processed) {
    if (line.id !== null && !linesById.has(line.id)) linesById.set(line.id, line);
  }

  // Second pass: merge bundle components into parents, even if the component came first.
  for (const component of processed) {
    if (component.parentId === null) continue;

    const parent = linesById.get(component.parentId);
    if (!parent) {
      warn(`Bundle parent ${component.parentId} was not found; component kept as a standalone line.`);
      continue;
    }
    if (parent === component) {
      warn(`Line ${component.id ?? 'with unknown ID'} points to itself as its bundle parent; kept standalone.`);
      continue;
    }

    parent.net_paise += component.net_paise;
    if (component.sku) parent.bundled_skus.push(component.sku);
    component.isComponent = true;
  }

  const lines = processed
    .filter((line) => !line.isComponent)
    .map(({ sku, qty, net_paise, bundled_skus }) => ({
      sku,
      qty,
      net_paise,
      bundled_skus,
    }));

  // Shipping uses discounted_price whenever it is present; otherwise price.
  const shippingLines = asArray(payload.shipping_lines, 'shipping_lines');
  const shippingTotal = shippingLines.reduce((sum: number, rawShipping: unknown, index: number) => {
    const shipping = isRecord(rawShipping) ? rawShipping : {};
    if (!isRecord(rawShipping)) warn(`shipping_lines[${index}] is invalid; treated as 0.`);
    const amount = shipping.discounted_price != null
      ? shipping.discounted_price
      : shipping.price;
    return sum + toPaise(amount, `shipping_lines[${index}].amount`);
  }, 0);

  // Gift note name comparison ignores case and surrounding whitespace.
  const noteAttributes = asArray(payload.note_attributes, 'note_attributes');
  const giftNoteAttribute = noteAttributes.find(
    (attribute) =>
      isRecord(attribute) &&
      typeof attribute.name === 'string' &&
      attribute.name.trim().toLowerCase() === 'gift_note',
  );
  const giftNote =
    isRecord(giftNoteAttribute) && typeof giftNoteAttribute.value === 'string'
      ? giftNoteAttribute.value.trim()
      : '';

  if (payload.id == null) warn('Order id is missing; order_id returned as null.');

  return {
    order_id: payload.id == null ? null : String(payload.id),
    customer_email: selectedEmail ? selectedEmail.trim().toLowerCase() : null,
    lines,
    total_discount_paise: totalDiscount,
    shipping_total_paise: shippingTotal,
    gift_note: giftNote || null,
    warnings,
  };
}
