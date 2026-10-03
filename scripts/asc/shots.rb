# List / download / replace App Store screenshots for a version (en-US).
#   ruby scripts/asc/shots.rb list VER
#   ruby scripts/asc/shots.rb download VER OUTDIR
#   ruby scripts/asc/shots.rb replace VER POSITION DISPLAY_TYPE FILE   # 1-based position in that set
require_relative "asc_lib"
require "digest"
require "fileutils"

def sets_for(ver)
  v = version(ver) or abort("no version #{ver}")
  loc = call("GET", "/v1/appStoreVersions/#{v["id"]}/appStoreVersionLocalizations")["data"]
          .find { |l| l["attributes"]["locale"] == "en-US" }
  call("GET", "/v1/appStoreVersionLocalizations/#{loc["id"]}/appScreenshotSets")["data"]
end

def shots(set_id)
  call("GET", "/v1/appScreenshotSets/#{set_id}/appScreenshots")["data"]
end

case ARGV[0]
when "list"
  sets_for(ARGV[1]).each do |s|
    list = shots(s["id"])
    puts "#{s["attributes"]["screenshotDisplayType"]}  #{list.size} shots  set=#{s["id"]}"
    list.each_with_index { |x, i| puts "  #{i + 1}. #{x["attributes"]["fileName"]}  #{x["attributes"]["assetDeliveryState"]&.dig("state")}" }
  end
when "download"
  FileUtils.mkdir_p(ARGV[2])
  sets_for(ARGV[1]).each do |s|
    shots(s["id"]).each_with_index do |x, i|
      a = x["attributes"]["imageAsset"] or next
      url = a["templateUrl"].sub("{w}", a["width"].to_s).sub("{h}", a["height"].to_s).sub("{f}", "png")
      out = File.join(ARGV[2], "#{s["attributes"]["screenshotDisplayType"]}-#{i + 1}.png")
      File.binwrite(out, Net::HTTP.get(URI(url)))
      puts out
    end
  end
when "replace"
  ver, pos, dtype, file = ARGV[1], ARGV[2].to_i, ARGV[3], ARGV[4]
  set = sets_for(ver).find { |s| s["attributes"]["screenshotDisplayType"] == dtype } or abort("no set #{dtype}")
  list = shots(set["id"])
  old = list[pos - 1] or abort("no shot at #{pos}")
  data = File.binread(file)
  # A set holds at most 10: remove the old shot first, then upload into the freed slot.
  call("DELETE", "/v1/appScreenshots/#{old["id"]}")
  res = call("POST", "/v1/appScreenshots", { data: { type: "appScreenshots",
          attributes: { fileName: File.basename(file), fileSize: data.bytesize },
          relationships: { appScreenshotSet: { data: { type: "appScreenshotSets", id: set["id"] } } } } })["data"]
  res["attributes"]["uploadOperations"].each do |op|
    uri = URI(op["url"])
    req = Net::HTTP.const_get(op["method"].capitalize).new(uri)
    op["requestHeaders"].each { |h| req[h["name"]] = h["value"] }
    req.body = data.byteslice(op["offset"], op["length"])
    r = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |h| h.request(req) }
    abort("upload part -> #{r.code}") unless r.code.to_i.between?(200, 299)
  end
  call("PATCH", "/v1/appScreenshots/#{res["id"]}", { data: { type: "appScreenshots", id: res["id"],
        attributes: { uploaded: true, sourceFileChecksum: Digest::MD5.hexdigest(data) } } })
  ids = shots(set["id"]).map { |x| x["id"] }
  ids.delete(res["id"]); ids.insert(pos - 1, res["id"])
  call("PATCH", "/v1/appScreenshotSets/#{set["id"]}/relationships/appScreenshots",
       { data: ids.map { |i| { type: "appScreenshots", id: i } } })
  puts "replaced #{dtype} ##{pos} with #{File.basename(file)}"
else
  abort("usage: list|download|replace")
end
