select
    transaction_id,
    store_id,
    sku,
    sold_at,
    quantity,
    unit_price,
    cast(0 as numeric)      as discount_amount,
    quantity * unit_price   as gross_amount,
    quantity * unit_price   as net_amount

from {{ ref('stg_stream_pos') }}
