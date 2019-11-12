local key = KEYS[1]
local expire = KEYS[2]
local value = KEYS[3]

if( redis.call('EXISTS',key) != 1 )then
    redis.call('setex',key,expire,value) 
    return 1
end
return 0