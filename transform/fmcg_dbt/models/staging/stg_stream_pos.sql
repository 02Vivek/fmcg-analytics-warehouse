with cleaned as (

    select
        cast(transaction_id as string) as transaction_id,
        cast(store_id as string)       as store_id,
        upper(trim(sku))               as sku,
        cast(qty as int64)             as quantity,
        cast(price as numeric)         as unit_price,
        cast(event_ts as timestamp)    as sold_at

    from {{ source('raw', 'raw_stream_pos') }}
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
    sold_at

from deduplicated
where row_num = 1
