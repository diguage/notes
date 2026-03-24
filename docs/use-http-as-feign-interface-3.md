---
title: 将 HTTP 服务封装成 Feign 接口时，两个处理错误的技巧
cover: ./assets/images/spring-cloud.png
author: D瓜哥
---

在上两篇文章“将 HTTP 服务封装成 Feign 接口”和“将 HTTP 服务封装成 Feign 接口的优点”中，介绍了如何将 HTTP 服务封装成 Feign 接口，以及由此带来的优点。在本文，继续分享两个处理“错误的”技巧。

## 一、错误码统一处理，只返回数据

一些符合最佳实践的接口在处理返回值时，通常会把返回状态编码、返回状态信息和数据分开处理。在 Java 中，一般将数据类型当作泛型来处理。在“将 HTTP 服务封装成 Feign 接口”提到，可以将返回值进行解密。还可以再进一步，将数据解密后，做反序列化处理，只返回给接口数据内容。而对错误根据错误码进行统一处理。示例如下：

```java
import com.diguage.common.CommonResult;
import com.diguage.exception.BusinessException;
import com.fasterxml.jackson.databind.JavaType;
import com.fasterxml.jackson.databind.ObjectMapper;
import feign.FeignException;
import feign.Response;
import feign.codec.Decoder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;

import java.io.IOException;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * @author D瓜哥 · https://www.diguage.com
 */
public class DecryptingDecoder implements Decoder {

  private static final Map<String, String> ERROR_MESSAGES = Map.of(
      "1000", "配置异常",
      "2000", "无效的签名",
      "3000", "数据不存在",
      "9000", "参数异常"
  );

  @Autowired
  private Config config;

  private Logger logger = LoggerFactory.getLogger("《服务类名》");

  private final ObjectMapper objectMapper = new ObjectMapper();

  @Override
  public Object decode(Response response, Type type) throws IOException, FeignException {
    // 1. 读取原始响应体（加密字符串）
    byte[] body = response.body().asInputStream().readAllBytes();
    String encrypted = new String(body, StandardCharsets.UTF_8);

    // 2. 解密
    String decrypted = decryptData(encrypted, config.getPrivateKey());
    logger.info("decryptedResponseBody: {}", decrypted);

    // 3. 反序列化
    // 注：参数 Type type 携带了接口期望的返回值类型。
    //    利用这个参数，就可以反序列化出正确的返回值对象。
    JavaType wrapperType = objectMapper.getTypeFactory()
        .constructParametricType(CommonResult.class, objectMapper.constructType(type));
    CommonResult<?> result = objectMapper.readValue(decrypted, wrapperType);

    if (result.isSuccess()) {
      return result.getData();
    }

    // 4. 处理异常
    String prefix = ERROR_MESSAGES.getOrDefault(result.getCode(), "系统异常");
    throw new BusinessException(prefix + "：" + result.getMessage());
  }
}
```

这样就可以把对返回值的判断集中起来，统一处理，调用接口的地方，可以直接拿到数据，编码会更加方便。

## 二、集中处理 HTTP 错误码

一些符合 HTTP 协议设计初衷的接口，在处理错误返回值时，会利用 HTTP 的错误状态码来承载对应的错误信息。这时，就需要使用自定义的 `ErrorDecoder` 实现类来处理错误信息了。示例如下：

```java
import feign.Response;
import feign.codec.ErrorDecoder;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.IOUtils;

import java.io.IOException;

/**
 * @author D瓜哥 · https://www.diguage.com
 */
@Slf4j
public class HttpErrorDecoder implements ErrorDecoder {

  private final ErrorDecoder defaultErrorDecoder = new Default();

  @Override
  public Exception decode(String methodKey, Response response) {
    try {
      int status = response.status();

      String body = IOUtils.toString(response.body().asReader(response.charset()));
      // 只处理非200响应
      if (status == 401) {
        return new BusinessException("签名错误：" + body);
      } else if (status == 500) {
        throw new BusinessException("服务系统异常" + body);
      }
      //...其他的错误码

    } catch (IOException e) {
      log.error("响应时发生 IO 异常", e);
      return new BusinessException("响应时发生 IO 异常");
    }

    return defaultErrorDecoder.decode(methodKey, response);
  }
}
```

这样就能集中处理 HTTP 的错误码了。
