require "jwt"; require "json"; require "net/http"; require "openssl"
# Read-only: list the app's App Store versions and their states. Same key the
# ship script uses; the .p8 is read from disk and never printed.
kid = "C8FRS9T697"; iss = "8bdd3f73-0d8b-427d-95c7-8097b77dfb7a"
p8 = File.join(Dir.home, ".appstoreconnect/private_keys/AuthKey_#{kid}.p8")
tok = JWT.encode({ iss: iss, exp: Time.now.to_i + 600, aud: "appstoreconnect-v1" }, OpenSSL::PKey::EC.new(File.read(p8)), "ES256", { kid: kid, typ: "JWT" })
uri = URI("https://api.appstoreconnect.apple.com/v1/apps/6775966055/appStoreVersions?limit=4&fields[appStoreVersions]=versionString,appStoreState,createdDate&include=build&fields[builds]=version,processingState")
r = Net::HTTP::Get.new(uri); r["Authorization"] = "Bearer #{tok}"
d = JSON.parse(Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |h| h.request(r) }.body)
builds = (d["included"] || []).to_h { |b| [b["id"], b["attributes"]["version"]] }
(d["data"] || []).each do |v|
  a = v["attributes"]; bid = v.dig("relationships", "build", "data", "id")
  puts "#{a["versionString"]}  #{a["appStoreState"]}  build=#{builds[bid] || '-'}  created=#{a["createdDate"][0, 10]}"
end
