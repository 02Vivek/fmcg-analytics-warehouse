with cleaned as (

    select
        cast(store_id as string)          as store_id,
        upper(trim(sku))                  as sku,
        cast(units_on_hand as int64)      as units_on_hand,
        cast(units_in_transit as int64)   as units_in_transit,
        cast(snapshot_date as date)       as snapshot_date

    from {{ source('raw', 'raw_inventory') }}
    where store_id is not null
      and sku is not null

),

deduplicated as (

    select
        *,
        row_number() over (
            partition by store_id, sku, snapshot_date
            order by snapshot_date desc
        ) as row_num

    from cleaned

)

select
    store_id,
    sku,
    units_on_hand,
    units_in_transit,
    snapshot_date

from deduplicated
where row_num = 1
