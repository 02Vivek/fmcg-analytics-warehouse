{{ config(materialized='incremental', unique_key='sales_key') }}

select
    {{ dbt_utils.generate_surrogate_key(['e.transaction_id', 'e.sku']) }} as sales_key,
    p.product_key,
    st.store_key,
    d.date_key,
    e.sold_at,
    e.quantity,
    e.gross_amount,
    e.discount_amount,
    e.net_amount

from {{ ref('int_sales_enriched') }} e
left join {{ ref('dim_product') }} p on e.sku = p.sku and p.is_current
left join {{ ref('dim_store') }} st on e.store_id = st.store_id
left join {{ ref('dim_date') }} d on date(e.sold_at) = d.date

{% if is_incremental() %}
where e.sold_at > (select max(sold_at) from {{ this }})
{% endif %}
