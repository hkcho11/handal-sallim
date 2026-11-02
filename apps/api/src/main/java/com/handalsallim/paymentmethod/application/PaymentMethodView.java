package com.handalsallim.paymentmethod.application;

import java.util.UUID;

public record PaymentMethodView(
    UUID id,
    String name,
    String type,
    UUID holderUserId,
    String color,
    String status,
    long version) {}
