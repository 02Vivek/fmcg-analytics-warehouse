with cleaned as (

    select
        upper(trim(sku))              as sku,
        trim(product_name)            as product_name,
        trim(brand)                   as brand,
        lower(trim(category))         as category,
        cast(pack_size as int64)      as pack_size

    from {{ source('raw', 'raw_product_master') }}
    where sku is not null

),

deduplicated as (

    select
        *,
        row_number() over (
            partition by sku
            order by sku
        ) as row_num

    from cleaned

)

select
    sku,
    product_name,
    brand,
    category,
    pack_size

from deduplicated
where row_num = 1
