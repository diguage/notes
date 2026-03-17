---
title: 将 HTTP 服务封装成 Feign 接口的优点
cover: ./assets/images/spring-cloud.png
author: D瓜哥
---

在上一篇文章“将 HTTP 服务封装成 Feign 接口”中，介绍了如何将 HTTP 服务封装成 Feign 接口。本文将继续讨论“将 HTTP 服务封装成 Feign 接口”带来的优点。

## 一、调用方式更“本地化”，代码可读性更好

传统 HTTP 调用一般是这样：

```java
HttpHeaders headers = new HttpHeaders();
headers.setContentType(MediaType.APPLICATION_JSON);

HttpEntity<Request> entity = new HttpEntity<>(req, headers);

ResponseEntity<Response> resp =
  restTemplate.exchange(url, HttpMethod.POST, entity, Response.class);
```

如果用 Feign：

```java
// 定义接口
@FeignClient(name = "order-service", url = "${order-service.url}", 
             configuration = OrderClientFeignConfig.class)
public interface OrderClient {

  @PostMapping("/order/create")
  OrderResponse create(@RequestBody OrderRequest request);

}

// 接口调用
orderClient.create(req);
```

调用起来非常方便，无需关注 HTTP 细节，代码更简洁、可读性更高。

## 二、更容易做 Mock / 集成测试

Feign 是 接口，所以可以很容易 Mock。

可以通过实现 `BeanFactoryPostProcessor` 接口，来替换 `FeignClient` 为 Mockito。

```java
package com.bitunix.payment.api.mock;

import org.mockito.Mockito;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.FactoryBean;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.beans.factory.support.BeanDefinitionBuilder;
import org.springframework.beans.factory.support.BeanDefinitionRegistry;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.core.Ordered;
import org.springframework.util.ClassUtils;

  /**
   * @author D瓜哥 · https://www.diguage.com
   */
public class FeignClientMockBeanFactoryPostProcessor implements BeanFactoryPostProcessor, Ordered {
  @Override
  public void postProcessBeanFactory(ConfigurableListableBeanFactory beanFactory) throws BeansException {
    if (!(beanFactory instanceof BeanDefinitionRegistry)) {
      return;
    }
    BeanDefinitionRegistry registry = (BeanDefinitionRegistry) beanFactory;
    String[] beanNames = registry.getBeanDefinitionNames();

    for (String beanName : beanNames) {

      BeanDefinition bd = registry.getBeanDefinition(beanName);

      if (bd.getBeanClassName() != null) {
        try {
          Class<?> clazz = ClassUtils.forName(bd.getBeanClassName(),
              Thread.currentThread().getContextClassLoader());
          if (clazz.isInterface() 
                && clazz.isAnnotationPresent(FeignClient.class)) {
            registry.removeBeanDefinition(beanName);
            registerMockDefinition(registry, beanName, clazz);
          }
        } catch (ClassNotFoundException ignored) {
        }
      }
    }
  }

  @Override
  public int getOrder() {
    return Ordered.LOWEST_PRECEDENCE;
  }

  /**
   * 注册一个返回 Mockito mock 的 bean 定义
   */
  private void registerMockDefinition(BeanDefinitionRegistry registry,
                                      String beanName,
                                      Class<?> interfaceClass) {
    BeanDefinitionBuilder builder = BeanDefinitionBuilder.rootBeanDefinition(MockFactoryBean.class);
    // 通过构造函数传入要 mock 的接口类型
    builder.addConstructorArgValue(interfaceClass);
    builder.setScope(BeanDefinition.SCOPE_SINGLETON);
    registry.registerBeanDefinition(beanName, builder.getBeanDefinition());
  }

  /**
   * 自定义 FactoryBean，用于生成 Mockito mock 对象
   */
  public static class MockFactoryBean<T> implements FactoryBean<T> {
    private final Class<T> interfaceClass;

    public MockFactoryBean(Class<T> interfaceClass) {
      this.interfaceClass = interfaceClass;
    }

    @Override
    public T getObject() throws Exception {
      return Mockito.mock(interfaceClass);
    }

    @Override
    public Class<?> getObjectType() {
      return interfaceClass;
    }

    @Override
    public boolean isSingleton() {
      return true;
    }
  }
}
```

这样，测试中获取的 `OrderClient` 都是 Mockito 的 Mock Bean，可以根据需要来自定义返回值，极大地方便测试的开发和运行。示例代码如下：

```java
@Autowired
private OrderClient orderClient; // 这里是一个 Mockito 的 Mock

when(orderClient.create(any(OrderRequest.class))).thenReturn(<期望的对象>);

// 测试代码
```

## 三、Feign 及扩展能力将 HTTP 协议细节被统一封装，统一拦截

访问 HTTP 接口，有很多 HTTP 层面的事情需要处理，例如：

* URL 拼接
* JSON 序列化 / 反序列化
* Header 处理
* Query 参数
* Form 参数

而这些都可以通过 Feign 提供的统一扩展点或者内置实现来进行处理。扩展点及对应的能力如下：

* `RequestInterceptor` -- 统一加 Header（签名 / Token / TraceId）
* `ErrorDecoder` -- 统一异常处理
* `Decoder` / `Encoder` - 自定义序列化
* `Logger` -- HTTP 调用日志
* `Retryer` -- 重试
* `Contract` -- 自定义注解解析