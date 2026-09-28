require "jwt"; require "json"; require "net/http"; require "openssl"
# Swap the build under the PENDING App Store version: cancel the open review
# submission, attach the new build once it is VALID, resubmit with automatic
# release. Founder, 2026-09-26: "Cut a new iOS build with the card title fix and
# swap review." Idempotent; the .p8 is read from disk and never printed.
APP = "6775966055"; VERSION = ENV.fetch("VER", "2.2"); BUILD = ENV.fetch("BUILD", "199")
kid = "C8FRS9T697"; iss = "8bdd3f73-0d8b-427d-95c7-8097b77dfb7a"
p8 = File.join(Dir.home, ".appstoreconnect/private_keys/AuthKey_#{kid}.p8")
TOK = JWT.encode({ iss: iss, exp: Time.now.to_i + 1100, aud: "appstoreconnect-v1" }, OpenSSL::PKey::EC.new(File.read(p8)), "ES256", { kid: kid, typ: "JWT" })
def call(method, path, body = nil)
  uri = URI("https://api.appstoreconnect.apple.com#{path}")
  r = { "GET" => Net::HTTP::Get, "POST" => Net::HTTP::Post, "PATCH" => Net::HTTP::Patch }[method].new(uri)
  r["Authorization"] = "Bearer #{TOK}"; r["Content-Type"] = "application/json"
  r.body = JSON.generate(body) if body
  res = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |h| h.request(r) }
  data = res.body.to_s.empty? ? {} : JSON.parse(res.body)
  unless res.code.to_i.between?(200, 299)
    puts "#{method} #{path} -> #{res.code}"; puts JSON.pretty_generate(data)[0, 1500]; exit 1
  end
  data
end

v = call("GET", "/v1/apps/#{APP}/appStoreVersions?filter[versionString]=#{VERSION}&filter[platform]=IOS&fields[appStoreVersions]=versionString,appStoreState,releaseType")["data"].first
abort("no version #{VERSION}") unless v
VID = v["id"]
puts "version #{VERSION}: #{v["attributes"]["appStoreState"]} releaseType=#{v["attributes"]["releaseType"]}"
cur = call("GET", "/v1/appStoreVersions/#{VID}/relationships/build")["data"]

# 1. Wait for the new build to finish processing BEFORE pulling anything from review.
build = nil
40.times do |i|
  bs = call("GET", "/v1/builds?filter[app]=#{APP}&filter[version]=#{BUILD}&filter[preReleaseVersion.version]=#{VERSION}&fields[builds]=version,processingState&limit=5")["data"]
  build = bs.find { |b| b["attributes"]["processingState"] == "VALID" }
  break if build
  puts "build #{BUILD}: #{bs.map { |b| b["attributes"]["processingState"] }.inspect} — waiting (#{i + 1})"
  sleep 30
end
abort("build #{BUILD} not VALID yet") unless build
puts "build #{BUILD} VALID (#{build["id"]})"
if cur && cur["id"] == build["id"]
  puts "build #{BUILD} already attached"
else
  # 2. Cancel the open review submission (this restarts Apple's clock — the founder asked).
  subs = call("GET", "/v1/reviewSubmissions?filter[app]=#{APP}&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES&fields[reviewSubmissions]=state,platform")["data"]
  subs.select { |s| s["attributes"]["platform"] == "IOS" }.each do |s|
    call("PATCH", "/v1/reviewSubmissions/#{s["id"]}", { data: { type: "reviewSubmissions", id: s["id"], attributes: { canceled: true } } })
    puts "canceled review submission #{s["id"]} (was #{s["attributes"]["state"]})"
  end
  sleep 5
  # 3. Attach the new build.
  call("PATCH", "/v1/appStoreVersions/#{VID}/relationships/build", { data: { type: "builds", id: build["id"] } })
  puts "attached build #{BUILD}"
end
# 4. Automatic release, then a fresh submission.
call("PATCH", "/v1/appStoreVersions/#{VID}", { data: { type: "appStoreVersions", id: VID, attributes: { releaseType: "AFTER_APPROVAL" } } })
subs = call("GET", "/v1/reviewSubmissions?filter[app]=#{APP}&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW&fields[reviewSubmissions]=state,platform")["data"]
sub = subs.find { |s| s["attributes"]["platform"] == "IOS" }
if sub && sub["attributes"]["state"] != "READY_FOR_REVIEW"
  puts "submission already #{sub["attributes"]["state"]}"; exit 0
end
sub ||= call("POST", "/v1/reviewSubmissions", { data: { type: "reviewSubmissions", attributes: { platform: "IOS" }, relationships: { app: { data: { type: "apps", id: APP } } } } })["data"]
items = call("GET", "/v1/reviewSubmissions/#{sub["id"]}/items?fields[reviewSubmissionItems]=state")["data"]
if items.empty?
  call("POST", "/v1/reviewSubmissionItems", { data: { type: "reviewSubmissionItems", relationships: { reviewSubmission: { data: { type: "reviewSubmissions", id: sub["id"] } }, appStoreVersion: { data: { type: "appStoreVersions", id: VID } } } } })
  puts "added version #{VERSION} to submission #{sub["id"]}"
end
call("PATCH", "/v1/reviewSubmissions/#{sub["id"]}", { data: { type: "reviewSubmissions", id: sub["id"], attributes: { submitted: true } } })
puts "SUBMITTED #{VERSION} (#{BUILD}) for review, automatic release"
