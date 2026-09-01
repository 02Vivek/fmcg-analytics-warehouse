with cleaned as (

    select
        cast(transaction_id as string) as transaction_id,
        cast(store_id as string)       as store_id,
        upper(trim(sku))               as sku,
        cast(qty as int64)             as quantity,
        cast(unit_price as numeric)    as unit_price,
        cast(discount as numeric)      as discount_amount,
        cast(sold_at as timestamp)     as sold_at

    from {{ source('raw', 'raw_sales') }}
    where transaction_id is not null
      and sku is not null

),

deduplicated as (

    select
        *,
        row_number() over (
            partition by transaction_id
            order by sold_at desc
        ) as row_num

    from cleaned

)

select
    transaction_id,
    store_id,
    sku,
    quantity,
    unit_price,
    discount_amount,
    sold_at

from deduplicated
where row_num = 1
