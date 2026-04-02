package com.openos.lp2

import okhttp3.ConnectionPool
import okhttp3.OkHttpClient
import okhttp3.Request as OkRequest
import org.schabi.newpipe.extractor.downloader.Downloader
import org.schabi.newpipe.extractor.downloader.Request
import org.schabi.newpipe.extractor.downloader.Response
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException
import java.util.concurrent.TimeUnit

object NewPipeDownloader : Downloader() {

    private const val UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .connectionPool(ConnectionPool(5, 30, TimeUnit.SECONDS))
        .followRedirects(true)
        .followSslRedirects(true)
        .retryOnConnectionFailure(true)
        .build()

    override fun execute(request: Request): Response {
        val builder = OkRequest.Builder().url(request.url())
        request.headers().forEach { (k, values) ->
            values.forEach { v -> builder.addHeader(k, v) }
        }
        if (!request.headers().containsKey("User-Agent")) {
            builder.header("User-Agent", UA)
        }
        if (request.httpMethod() == "POST") {
            val body = request.dataToSend()?.let {
                okhttp3.RequestBody.create(null, it)
            } ?: okhttp3.RequestBody.create(null, ByteArray(0))
            builder.post(body)
        }
        val resp = client.newCall(builder.build()).execute()
        if (resp.code == 429) {
            resp.close()
            throw ReCaptchaException("Rate limited", request.url())
        }
        return Response(
            resp.code,
            resp.message,
            resp.headers.toMultimap(),
            resp.body?.string(),
            request.url()
        )
    }
}
