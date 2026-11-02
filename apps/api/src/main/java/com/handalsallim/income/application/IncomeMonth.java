package com.handalsallim.income.application;

import java.util.List;

public record IncomeMonth(String month, String totalAmount, List<IncomeView> items) {}
