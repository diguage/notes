---
title: 将 HTTP 服务封装成 Feign 接口
cover: ./spring-cloud.png
author: D瓜哥
---

今天在看代码时，发现可以把 HTTP 服务接口封装成 Feign 接口，了解了一下，感觉这个方案确实不错。不过，有两个问题解决一下：

1. 附加的 Header 属性，比如转发 IP 的 `X-Forwarded-For` 属性。
2. 返回数据的整体解密

## 附加的 Header 属性

某些 HTTP 服务要求在请求 Header 中携带客户端 IP（例如 `X-Forwarded-For` 或自定义 Header）。

解决方案：**实现 RequestInterceptor 接口，在拦截器中将 IP 添加到请求头。** 示例如下：

### `IpHeaderInterceptor`

```java
import feign.RequestInterceptor;
import feign.RequestTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import javax.servlet.http.HttpServletRequest;

@Component
public class IpHeaderInterceptor implements RequestInterceptor {

    @Override
    public void apply(RequestTemplate template) {
        // 从当前请求上下文中获取真实客户端 IP（适用于 Web 环境）
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attributes != null) {
            HttpServletRequest request = attributes.getRequest();
            String clientIp = getClientIp(request); // 自定义方法获取 IP
            template.header("X-Forwarded-For", clientIp);
        } else {
            // 非 Web 环境（如定时任务）可设置默认 IP 或通过其他方式获取
            template.header("X-Forwarded-For", "127.0.0.1");
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        return ip;
    }
}
```

### 配置类

```java
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class HttpFeignConfig {

    @Bean
    public RequestInterceptor ipHeaderInterceptor() {
        return new IpHeaderInterceptor();
    }
}
```

### 配置到指定 `FeignClient`

```java
@FeignClient(name = "service", url = "${service.url}", 
             configuration = HttpFeignConfig.class)
public interface ServiceClient {
    // ...
}
```

## 响应内容解密

某些服务的返回值是加密的，需要在 Feign 收到响应后自动解密，再返回给调用方。

解决方案：**自定义 `Decoder`，在解码之前对加密的响应体进行解密。** 通常响应体可能是完整的加密字符串，解密后得到 JSON 或其他格式，再交给默认解码器（如 `SpringDecoder`）进行反序列化。示例如下：

### `DecryptingDecoder`

```java
import feign.FeignException;
import feign.Response;
import feign.codec.Decoder;

import java.io.IOException;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;

public class DecryptingDecoder implements Decoder {

    private final Decoder delegate;
    private final CryptoService cryptoService; // 解密服务，需自行实现

    public DecryptingDecoder(Decoder delegate, CryptoService cryptoService) {
        this.delegate = delegate;
        this.cryptoService = cryptoService;
    }

    @Override
    public Object decode(Response response, Type type) throws IOException, FeignException {
        // 1. 读取原始响应体（加密字符串）
        byte[] body = response.body().asInputStream().readAllBytes();
        String encrypted = new String(body, StandardCharsets.UTF_8);

        // 2. 解密
        String decrypted = cryptoService.decrypt(encrypted);

        // 3. 构建新的 Response 对象，将解密后的内容作为新的响应体
        Response newResponse = response.toBuilder()
                .body(decrypted, StandardCharsets.UTF_8)
                .build();

        // 4. 委托给原解码器进行正常的 JSON 反序列化
        return delegate.decode(newResponse, type);
    }
}
```

### 配置类

```java
import feign.codec.Decoder;
import org.springframework.beans.factory.ObjectFactory;
import org.springframework.boot.autoconfigure.http.HttpMessageConverters;
import org.springframework.cloud.openfeign.support.SpringDecoder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ServiceFeignConfig {

    @Bean
    public Decoder feignDecoder(CryptoService cryptoService, ObjectFactory<HttpMessageConverters> messageConverters) {
        // 使用 SpringDecoder 作为委托解码器，
        // 它内部会利用 HttpMessageConverters 进行反序列化
        Decoder springDecoder = new SpringDecoder(messageConverters);
        return new DecryptingDecoder(cryptoService);
    }

    // 如果有其他拦截器也可在此配置
}
```

### 配置自定义 Decoder 到 FeignClient

```java
@FeignClient(name = "service", url = "${service.url}", 
             configuration = ServiceFeignConfig.class)
public interface ServiceClient {
    // ...
}
```

通过上面两步处理，即可把 HTTP 服务封装成一个 Feign 接口。在项目中，调用 HTTP 服务，像调用本地方法一样方便。

> 最新版的 Spring Cloud 引入了 HTTP Exchange 来增加对 HTTP 接口的处理。有机会再给大家介绍。
