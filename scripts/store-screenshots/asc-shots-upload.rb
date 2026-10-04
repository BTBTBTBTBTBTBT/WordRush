require "jwt"; require "json"; require "net/http"; require "openssl"; require "digest"
# Replace the App Store screenshots of version VER (en-US): APP_IPHONE_67 <- store-out/67, APP_IPHONE_65 <- store-out/65.
# Deletes the current shots in each set, reserves + uploads + commits the new ones in order, then reorders.
APP = "6775966055"; VERSION = ENV.fetch("VER", "2.3")
kid = "C8FRS9T697"; iss = "8bdd3f73-0d8b-427d-95c7-8097b77dfb7a"
p8 = File.join(Dir.home, ".appstoreconnect/private_keys/AuthKey_#{kid}.p8")
def token(kid, iss, p8); JWT.encode({ iss: iss, exp: Time.now.to_i + 1100, aud: "appstoreconnect-v1" }, OpenSSL::PKey::EC.new(File.read(p8)), "ES256", { kid: kid, typ: "JWT" }); end
TOK = token(kid, iss, p8)
def call(method, path, body = nil)
  uri = URI("https://api.appstoreconnect.apple.com#{path}")
  r = { "GET" => Net::HTTP::Get, "POST" => Net::HTTP::Post, "PATCH" => Net::HTTP::Patch, "DELETE" => Net::HTTP::Delete }[method].new(uri)
  r["Authorization"] = "Bearer #{TOK}"; r["Content-Type"] = "application/json"
  r.body = JSON.generate(body) if body
  res = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |h| h.request(r) }
  data = res.body.to_s.empty? ? {} : JSON.parse(res.body)
  unless res.code.to_i.between?(200, 299)
    puts "#{method} #{path} -> #{res.code}"; puts JSON.pretty_generate(data)[0, 1500]; exit 1
  end
  data
end
v = call("GET", "/v1/apps/#{APP}/appStoreVersions?filter[versionString]=#{VERSION}&filter[platform]=IOS")["data"].first or abort("no version #{VERSION}")
loc = call("GET", "/v1/appStoreVersions/#{v["id"]}/appStoreVersionLocalizations?filter[locale]=en-US")["data"].first
sets = call("GET", "/v1/appStoreVersionLocalizations/#{loc["id"]}/appScreenshotSets?fields[appScreenshotSets]=screenshotDisplayType")["data"]
{ "APP_IPHONE_67" => "67", "APP_IPHONE_65" => "65" }.each do |type, dir|
  set = sets.find { |s| s["attributes"]["screenshotDisplayType"] == type }
  unless set
    set = call("POST", "/v1/appScreenshotSets", { data: { type: "appScreenshotSets", attributes: { screenshotDisplayType: type }, relationships: { appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: loc["id"] } } } } })["data"]
    puts "created set #{type}"
  end
  old = call("GET", "/v1/appScreenshotSets/#{set["id"]}/appScreenshots?fields[appScreenshots]=fileName&limit=50")["data"]
  old.each { |sh| call("DELETE", "/v1/appScreenshots/#{sh["id"]}") }
  puts "#{type}: removed #{old.size} old shots"
  files = Dir[File.join(__dir__, "store-out", dir, "*.png")].sort
  ids = []
  files.each do |f|
    bytes = File.binread(f)
    sh = call("POST", "/v1/appScreenshots", { data: { type: "appScreenshots", attributes: { fileName: File.basename(f), fileSize: bytes.bytesize }, relationships: { appScreenshotSet: { data: { type: "appScreenshotSets", id: set["id"] } } } } })["data"]
    sh["attributes"]["uploadOperations"].each do |op|
      uri = URI(op["url"]); req = Net::HTTP::Put.new(uri)
      op["requestHeaders"].each { |h| req[h["name"]] = h["value"] }
      req.body = bytes[op["offset"], op["length"]]
      res = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |h| h.request(req) }
      abort("chunk upload #{res.code} for #{f}") unless res.code.to_i.between?(200, 299)
    end
    call("PATCH", "/v1/appScreenshots/#{sh["id"]}", { data: { type: "appScreenshots", id: sh["id"], attributes: { uploaded: true, sourceFileChecksum: Digest::MD5.hexdigest(bytes) } } })
    ids << sh["id"]; puts "  uploaded #{File.basename(f)} (#{bytes.bytesize / 1024} KB)"
  end
  call("PATCH", "/v1/appScreenshotSets/#{set["id"]}/relationships/appScreenshots", { data: ids.map { |i| { type: "appScreenshots", id: i } } })
  puts "#{type}: ordered #{ids.size} shots"
end
# wait for processing
20.times do
  states = sets.map { |s| call("GET", "/v1/appScreenshotSets/#{s["id"]}/appScreenshots?fields[appScreenshots]=assetDeliveryState&limit=50")["data"].map { |x| x.dig("attributes", "assetDeliveryState", "state") } }.flatten
  puts "states: #{states.group_by(&:itself).transform_values(&:size)}"
  break if states.all? { |st| st == "COMPLETE" }
  abort("a screenshot FAILED") if states.include?("FAILED")
  sleep 10
end
