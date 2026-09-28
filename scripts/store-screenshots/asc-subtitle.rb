require "jwt"; require "json"; require "net/http"; require "openssl"
# Set the App Store subtitle (en-US) on the app's editable appInfo. Founder, 2026-09-28: "Daily Word Games".
APP = "6775966055"; SUBTITLE = ENV.fetch("SUBTITLE", "Daily Word Games")
kid = "C8FRS9T697"; iss = "8bdd3f73-0d8b-427d-95c7-8097b77dfb7a"
p8 = File.join(Dir.home, ".appstoreconnect/private_keys/AuthKey_#{kid}.p8")
TOK = JWT.encode({ iss: iss, exp: Time.now.to_i + 900, aud: "appstoreconnect-v1" }, OpenSSL::PKey::EC.new(File.read(p8)), "ES256", { kid: kid, typ: "JWT" })
def call(method, path, body = nil)
  uri = URI("https://api.appstoreconnect.apple.com#{path}")
  r = { "GET" => Net::HTTP::Get, "PATCH" => Net::HTTP::Patch }[method].new(uri)
  r["Authorization"] = "Bearer #{TOK}"; r["Content-Type"] = "application/json"
  r.body = JSON.generate(body) if body
  res = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |h| h.request(r) }
  data = res.body.to_s.empty? ? {} : JSON.parse(res.body)
  [res.code.to_i, data]
end
code, infos = call("GET", "/v1/apps/#{APP}/appInfos?fields[appInfos]=appStoreState,state")
infos["data"].each do |info|
  st = info["attributes"]["appStoreState"] || info["attributes"]["state"]
  c2, locs = call("GET", "/v1/appInfos/#{info["id"]}/appInfoLocalizations?fields[appInfoLocalizations]=locale,name,subtitle")
  locs["data"].each do |l|
    a = l["attributes"]
    puts "appInfo #{info["id"]} [#{st}] #{a["locale"]}: name=#{a["name"].inspect} subtitle=#{a["subtitle"].inspect}"
    next unless a["locale"] == "en-US"
    next if ENV["DRY"] == "1"
    c3, res = call("PATCH", "/v1/appInfoLocalizations/#{l["id"]}", { data: { type: "appInfoLocalizations", id: l["id"], attributes: { subtitle: SUBTITLE } } })
    if c3.between?(200, 299) then puts "  -> subtitle set to #{SUBTITLE.inspect}"
    else puts "  -> PATCH #{c3}: #{(res.dig("errors", 0, "detail") || res).to_s[0, 300]}" end
  end
end
