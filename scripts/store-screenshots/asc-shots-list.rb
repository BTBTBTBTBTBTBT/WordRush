require "jwt"; require "json"; require "net/http"; require "openssl"
# List the App Store screenshot sets (display types + counts) on the 2.3 version, or the latest one.
APP = "6775966055"; VERSION = ENV.fetch("VER", "2.3")
kid = "C8FRS9T697"; iss = "8bdd3f73-0d8b-427d-95c7-8097b77dfb7a"
p8 = File.join(Dir.home, ".appstoreconnect/private_keys/AuthKey_#{kid}.p8")
TOK = JWT.encode({ iss: iss, exp: Time.now.to_i + 900, aud: "appstoreconnect-v1" }, OpenSSL::PKey::EC.new(File.read(p8)), "ES256", { kid: kid, typ: "JWT" })
def call(method, path, body = nil)
  uri = URI("https://api.appstoreconnect.apple.com#{path}")
  r = { "GET" => Net::HTTP::Get, "POST" => Net::HTTP::Post, "PATCH" => Net::HTTP::Patch, "DELETE" => Net::HTTP::Delete }[method].new(uri)
  r["Authorization"] = "Bearer #{TOK}"; r["Content-Type"] = "application/json"
  r.body = JSON.generate(body) if body
  res = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |h| h.request(r) }
  data = res.body.to_s.empty? ? {} : JSON.parse(res.body)
  unless res.code.to_i.between?(200, 299)
    puts "#{method} #{path} -> #{res.code}"; puts JSON.pretty_generate(data)[0, 1200]; exit 1
  end
  data
end
vers = call("GET", "/v1/apps/#{APP}/appStoreVersions?filter[platform]=IOS&fields[appStoreVersions]=versionString,appStoreState&limit=3")["data"]
vers.each { |v| puts "#{v["attributes"]["versionString"]}  #{v["attributes"]["appStoreState"]}  #{v["id"]}" }
v = vers.find { |x| x["attributes"]["versionString"] == VERSION } || vers.first
puts "inspecting #{v["attributes"]["versionString"]}"
locs = call("GET", "/v1/appStoreVersions/#{v["id"]}/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale")["data"]
locs.each do |l|
  puts "locale #{l["attributes"]["locale"]} (#{l["id"]})"
  sets = call("GET", "/v1/appStoreVersionLocalizations/#{l["id"]}/appScreenshotSets?fields[appScreenshotSets]=screenshotDisplayType&include=appScreenshots&fields[appScreenshots]=fileName,imageAsset,assetDeliveryState")
  sets["data"].each do |s|
    ids = (s.dig("relationships", "appScreenshots", "data") || []).map { |x| x["id"] }
    puts "  set #{s["attributes"]["screenshotDisplayType"]} (#{s["id"]}) shots=#{ids.size}"
  end
  (sets["included"] || []).each do |sh|
    a = sh["attributes"]; w = a.dig("imageAsset", "width"); h = a.dig("imageAsset", "height")
    puts "    #{a["fileName"]} #{w}x#{h} #{a.dig("assetDeliveryState", "state")}"
  end
end
