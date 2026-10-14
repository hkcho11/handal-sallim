package com.handalsallim.dashboard.local;

import jakarta.servlet.Filter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import java.security.Principal;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.*;

@Configuration
@Profile("local")
public class LocalDashboardConfiguration {
  @Bean
  FilterRegistrationBean<Filter> dashboardLocalPrincipal() {
    Filter filter =
        (request, response, chain) ->
            chain.doFilter(
                new HttpServletRequestWrapper((HttpServletRequest) request) {
                  @Override
                  public Principal getUserPrincipal() {
                    return () -> "00000000-0000-0000-0000-000000000001";
                  }
                },
                response);
    var registration = new FilterRegistrationBean<>(filter);
    registration.addUrlPatterns("/api/dashboard");
    registration.setName("dashboardLocalPrincipal");
    return registration;
  }
}
