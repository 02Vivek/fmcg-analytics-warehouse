select
    {{ dbt_utils.generate_surrogate_key(['i.sku', 'i.store_id', 'i.snapshot_date']) }} as inventory_key,
    p.product_key,
    st.store_key,
    d.date_key,
    i.units_on_hand,
    i.units_in_transit

from {{ ref('stg_inventory') }} i
left join {{ ref('dim_product') }} p on i.sku = p.sku and p.is_current
left join {{ ref('dim_store') }} st on i.store_id = st.store_id
left join {{ ref('dim_date') }} d on i.snapshot_date = d.date
