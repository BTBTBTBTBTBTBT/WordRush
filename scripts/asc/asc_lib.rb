# App Store Connect helper (rebuilt 2026-10-03 after the scratchpad was wiped).
# Same API key as apps/ios/ship.sh; the .p8 is read from disk and never printed.
#
#   ruby scripts/asc/asc.rb versions
#   ruby scripts/asc/asc.rb submit VER BUILD [whats-new.txt]   # attach build, What's New, submit, auto-release
#   ruby scripts/asc/asc.rb cancel                              # cancel the open review submission
#   DRY=1 ruby scripts/asc/asc.rb submit ...                    # print what would change
require "jwt"
require "openssl"
require "json"
require "net/http"
require "uri"

APP = "6775966055"
KID = "C8FRS9T697"
ISS = "8bdd3f73-0d8b-427d-95c7-8097b77dfb7a"
P8 = File.join(Dir.home, ".appstoreconnect/private_keys/AuthKey_#{KID}.p8")
DRY = ENV["DRY"] == "1"

def token
  JWT.encode({ iss: ISS, exp: Time.now.to_i + 900, aud: "appstoreconnect-v1" },
             OpenSSL::PKey::EC.new(File.read(P8)), "ES256", { kid: KID, typ: "JWT" })
end

def call(method, path, body = nil)
  uri = URI("https://api.appstoreconnect.apple.com#{path}")
  req = { "GET" => Net::HTTP::Get, "POST" => Net::HTTP::Post, "PATCH" => Net::HTTP::Patch,
          "DELETE" => Net::HTTP::Delete }.fetch(method).new(uri)
  req["Authorization"] = "Bearer #{token}"
  req["Content-Type"] = "application/json"
  req.body = body.to_json if body
  if DRY && method != "GET"
    puts "DRY #{method} #{path} #{body&.to_json}"
    return { "data" => { "id" => "dry" } }
  end
  res = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |h| h.request(req) }
  abort("#{method} #{path} -> #{res.code} #{res.body}") unless res.code.to_i.between?(200, 299)
  res.body.to_s.empty? ? {} : JSON.parse(res.body)
end

def version(ver)
  call("GET", "/v1/apps/#{APP}/appStoreVersions?filter[versionString]=#{ver}&filter[platform]=IOS" \
              "&fields[appStoreVersions]=versionString,appStoreState,releaseType")["data"].first
end

def open_submissions
  call("GET", "/v1/reviewSubmissions?filter[app]=#{APP}&filter[platform]=IOS" \
              "&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES")["data"]
end

