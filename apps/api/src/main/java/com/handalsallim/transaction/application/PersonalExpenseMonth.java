package com.handalsallim.transaction.application;

import java.util.List;

public record PersonalExpenseMonth(
    String month, String totalAmount, List<PersonalExpenseView> items) {}
