with all_store_ids as (

    select store_id from {{ ref('stg_sales') }}
    union distinct
    select store_id from {{ ref('stg_inventory') }}

)

select
    {{ dbt_utils.generate_surrogate_key(['store_id']) }} as store_key,
    store_id

from all_store_ids
