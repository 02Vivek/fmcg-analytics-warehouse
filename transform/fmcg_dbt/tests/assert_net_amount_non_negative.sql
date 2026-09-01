select sales_key, net_amount
from {{ ref('fct_sales') }}
where net_amount < 0
