with batch as (
    select *, 'batch' as source_type
    from {{ ref('int_sales_enriched') }}
),

stream as (
    select *, 'stream' as source_type
    from {{ ref('int_stream_enriched') }}
),

combined as (
    select * from batch
    union all
    select * from stream
)

select
    {{ dbt_utils.generate_surrogate_key(['c.transaction_id', 'c.sku', 'c.source_type']) }} as sales_key,
    p.product_key,
    st.store_key,
    d.date_key,
    c.source_type,
    c.sold_at,
    c.quantity,
    c.gross_amount,
    c.discount_amount,
    c.net_amount

from combined c
left join {{ ref('dim_product') }} p on c.sku = p.sku and p.is_current
left join {{ ref('dim_store') }} st on c.store_id = st.store_id
left join {{ ref('dim_date') }} d on date(c.sold_at) = d.date
