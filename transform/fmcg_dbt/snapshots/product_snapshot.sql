{% snapshot product_snapshot %}

{{
    config(
        target_schema='dev_staging',
        unique_key='sku',
        strategy='check',
        check_cols=['product_name', 'brand', 'category', 'pack_size']
    )
}}

select * from {{ ref('stg_product') }}

{% endsnapshot %}
