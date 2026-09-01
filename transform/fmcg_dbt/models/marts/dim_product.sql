select
    {{ dbt_utils.generate_surrogate_key(['sku', 'dbt_valid_from']) }} as product_key,
    sku,
    product_name,
    brand,
    category,
    pack_size,
    dbt_valid_from                        as valid_from,
    dbt_valid_to                          as valid_to,
    dbt_valid_to is null                  as is_current

from {{ ref('product_snapshot') }}
