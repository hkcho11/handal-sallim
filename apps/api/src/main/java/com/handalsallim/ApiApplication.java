package com.handalsallim;

import java.time.Clock;
import java.time.ZoneId;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class ApiApplication {

  @Bean
  Clock businessClock() {
    return Clock.system(ZoneId.of("Asia/Seoul"));
  }

  public static void main(String[] args) {
    SpringApplication.run(ApiApplication.class, args);
  }
}
