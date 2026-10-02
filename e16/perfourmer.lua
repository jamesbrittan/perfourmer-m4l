-- Perfourmer Hub ↔ E16 controller script
--
-- Thin bridge: every encoder is "manual". A turn sends one CC per click
-- (relative encoding: 65 = +1, 63 = −1). The Hub sends SysEx back to set
-- each encoder's label, ring position and colour.
--
-- This script knows nothing about the Hub's parameters — all logic lives in
-- the Hub. It only relays increments and renders what it's told.
--
-- Protocol (must match engine/src/e16.ts):
--   CC channel 16, encoders CC 20–35 (relative), pushes CC 40–55, page CC 119
--   SysEx F0 00 7F 7F 01 <enc> <ring> <r> <g> <b> <c0..c3> F7
--         enc 0x7F = page title

-- ── Configuration ───────────────────────────────────────────────────────────

local MIDI_CH       = 16    -- MIDI channel
local ENC_CC_BASE   = 20    -- first encoder CC
local PUSH_CC_BASE  = 40    -- first push-button CC
local PAGE_CC       = 119   -- page-change CC

-- SysEx header to match (manufacturer ID 00 7F 7F, device 01)
local SYSEX_MATCH = { 0x00, 0x7F, 0x7F, 0x01 }

-- ── Encoder setup ───────────────────────────────────────────────────────────

function on_load()
  for i = 0, 15 do
    -- Manual mode: the script gets raw increments, not absolute values.
    -- The "initial" value is set to 64 so the encoder has room to move in
    -- both directions; after each turn we write 64 back so it never sticks
    -- at the endpoints.
    set_encoder_mode(i, MODE_MANUAL)
    set_encoder_value(i, 64)
    set_encoder_label(i, "    ")
    set_encoder_ring(i, 0)
  end
  set_page_title("PF4 ")
end

-- ── Encoder turn → CC ───────────────────────────────────────────────────────

function on_encoder(encoder, value)
  -- value is absolute (0–127) in manual mode; compute delta from 64
  local delta = value - 64
  if delta == 0 then return end

  -- Send relative CC: 65 = +1, 63 = −1, etc.
  local cc_value = 64 + delta
  if cc_value < 0 then cc_value = 0 end
  if cc_value > 127 then cc_value = 127 end

  send_cc(MIDI_CH, ENC_CC_BASE + encoder, cc_value)

  -- Reset to midpoint so the encoder never reaches its endpoints
  set_encoder_value(encoder, 64)
end

-- ── Encoder push → CC ───────────────────────────────────────────────────────

function on_push(encoder, pressed)
  if pressed then
    send_cc(MIDI_CH, PUSH_CC_BASE + encoder, 127)
  else
    send_cc(MIDI_CH, PUSH_CC_BASE + encoder, 0)
  end
end

-- ── Page change → CC ────────────────────────────────────────────────────────

function on_page(page)
  send_cc(MIDI_CH, PAGE_CC, page)
end

-- ── SysEx from the Hub → display update ─────────────────────────────────────

function on_sysex(data)
  -- Verify header: 00 7F 7F 01
  if #data < 14 then return end
  for i = 1, #SYSEX_MATCH do
    if data[i] ~= SYSEX_MATCH[i] then return end
  end

  local enc  = data[5]
  local ring = data[6]
  local r    = data[7]
  local g    = data[8]
  local b    = data[9]
  local label = string.char(data[10], data[11], data[12], data[13])

  if enc == 0x7F then
    -- Page title
    set_page_title(label)
  else
    -- Encoder update
    set_encoder_label(enc, label)
    set_encoder_ring(enc, ring)
    set_encoder_color(enc, r, g, b)
  end
end
