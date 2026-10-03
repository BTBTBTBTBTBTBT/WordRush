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

case ARGV[0]
when "versions"
  call("GET", "/v1/apps/#{APP}/appStoreVersions?filter[platform]=IOS&limit=5" \
              "&fields[appStoreVersions]=versionString,appStoreState,releaseType,createdDate")["data"].each do |v|
    a = v["attributes"]
    puts "#{a["versionString"]}  #{a["appStoreState"]}  #{a["releaseType"]}  #{a["createdDate"]}"
  end
  open_submissions.each { |s| puts "open submission #{s["id"]} #{s["attributes"]["state"]}" }

when "cancel"
  subs = open_submissions
  puts "no open submission" if subs.empty?
  subs.each do |s|
    call("PATCH", "/v1/reviewSubmissions/#{s["id"]}",
         { data: { type: "reviewSubmissions", id: s["id"], attributes: { canceled: true } } })
    puts "cancel requested #{s["id"]} (#{s["attributes"]["state"]})"
  end

when "submit"
  ver, build_no, notes_file = ARGV[1], ARGV[2], ARGV[3]
  abort("usage: submit VER BUILD [whats-new.txt]") unless ver && build_no
  v = version(ver) or abort("version #{ver} not found")
  vid = v["id"]
  puts "version #{ver}: #{v["attributes"]["appStoreState"]} release=#{v["attributes"]["releaseType"]}"
  if v["attributes"]["releaseType"] != "AFTER_APPROVAL"
    call("PATCH", "/v1/appStoreVersions/#{vid}",
         { data: { type: "appStoreVersions", id: vid, attributes: { releaseType: "AFTER_APPROVAL" } } })
    puts "  releaseType -> AFTER_APPROVAL (auto-release)"
  end

  b = call("GET", "/v1/builds?filter[app]=#{APP}&filter[version]=#{build_no}" \
                  "&filter[preReleaseVersion.version]=#{ver}&fields[builds]=version,processingState")["data"]
         .find { |x| x["attributes"]["processingState"] == "VALID" } or abort("build #{build_no} not VALID")
  call("PATCH", "/v1/appStoreVersions/#{vid}/relationships/build", { data: { type: "builds", id: b["id"] } })
  puts "attached build #{build_no}"

  if notes_file
    notes = File.read(notes_file).strip
    loc = call("GET", "/v1/appStoreVersions/#{vid}/appStoreVersionLocalizations")["data"]
            .find { |l| l["attributes"]["locale"] == "en-US" } or abort("no en-US localization")
    call("PATCH", "/v1/appStoreVersionLocalizations/#{loc["id"]}",
         { data: { type: "appStoreVersionLocalizations", id: loc["id"], attributes: { whatsNew: notes } } })
    puts "What's New set (#{notes.length} chars)"
  end

  sub = open_submissions.find { |s| s["attributes"]["state"] == "READY_FOR_REVIEW" }
  sub ||= call("POST", "/v1/reviewSubmissions",
               { data: { type: "reviewSubmissions", attributes: { platform: "IOS" },
                         relationships: { app: { data: { type: "apps", id: APP } } } } })["data"]
  call("POST", "/v1/reviewSubmissionItems",
       { data: { type: "reviewSubmissionItems",
                 relationships: { reviewSubmission: { data: { type: "reviewSubmissions", id: sub["id"] } },
                                  appStoreVersion: { data: { type: "appStoreVersions", id: vid } } } } })
  call("PATCH", "/v1/reviewSubmissions/#{sub["id"]}",
       { data: { type: "reviewSubmissions", id: sub["id"], attributes: { submitted: true } } })
  puts "SUBMITTED #{ver} (#{build_no}) for review, automatic release"

else
  abort("usage: ruby scripts/asc/asc.rb versions|cancel|submit VER BUILD [whats-new.txt]")
end
