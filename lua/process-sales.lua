--[[
    This should recursively move all the current elements inside the sales list to a `processing` hash.
--]]

local sales = KEYS[1];
local JSONKey = KEYS[2] or 'ID';
local processingSales = sales .. ':processing';
local returnValue = { }

local currentLength = redis.call('LLEN', sales);
for i = 0, currentLength - 1 do
    local element = redis.call('LPOP', sales);
    local ID = cjson.decode(element)[JSONKey];
    returnValue[i+1] = element

    -- Add some sort of rollback here if this fails
    redis.call('HSET', processingSales, ID, element)
end;

return returnValue;
