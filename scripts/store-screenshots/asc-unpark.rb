require "jwt"; require "json"; require "net/http"; require "openssl"
# Remove the items of the open (not yet submitted) iOS review submission so the version's metadata unlocks.
APP = "6775966055"
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
subs = call("GET", "/v1/reviewSubmissions?filter[app]=#{APP}&filter[state]=READY_FOR_REVIEW&fields[reviewSubmissions]=state,platform")["data"]
subs.each do |sub|
  next unless sub["attributes"]["platform"] == "IOS"
  items = call("GET", "/v1/reviewSubmissions/#{sub["id"]}/items?fields[reviewSubmissionItems]=state")["data"]
  items.each { |it| call("DELETE", "/v1/reviewSubmissionItems/#{it["id"]}"); puts "removed item #{it["id"]} from submission #{sub["id"]}" }
  puts "submission #{sub["id"]} now empty (#{sub["attributes"]["state"]})"
end
puts "done"
