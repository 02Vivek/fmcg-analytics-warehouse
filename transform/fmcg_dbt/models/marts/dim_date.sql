with date_spine as (

    {{ dbt_utils.date_spine(
        datepart="day",
        start_date="cast('2024-01-01' as date)",
        end_date="cast('2028-01-01' as date)"
    ) }}

)

select
    {{ dbt_utils.generate_surrogate_key(['date_day']) }} as date_key,
    date_day as date,
    extract(year from date_day)                        as year,
    extract(quarter from date_day)                      as quarter,
    extract(month from date_day)                        as month,
    extract(day from date_day)                           as day_of_month,
    extract(dayofweek from date_day)                     as day_of_week,
    format_date('%A', date_day)                          as day_name,
    format_date('%B', date_day)                          as month_name,
    extract(dayofweek from date_day) in (1, 7)           as is_weekend

from date_spine
