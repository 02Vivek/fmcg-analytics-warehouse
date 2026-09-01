select
    transaction_id,
    store_id,
    sku,
    sold_at,
    quantity,
    unit_price,
    discount_amount,
    quantity * unit_price               as gross_amount,
    (quantity * unit_price) - discount_amount as net_amount

from {{ ref('stg_sales') }}
